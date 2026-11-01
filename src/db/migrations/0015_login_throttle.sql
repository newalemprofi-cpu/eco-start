-- Persistent login throttling (brute-force protection for child
-- login_code + PIN, and every other login). Replaces the in-memory
-- limiter, which reset on every deploy/restart and was per-process.
--
-- Additive only: one new table + four functions. No existing row is
-- touched.
--
-- Two independent buckets per attempt:
--   scope 'identifier' — the login code / email being guessed
--   scope 'ip'         — the client address doing the guessing
-- The IP bucket is what stops walking a predictable list of login codes
-- (ГРУППА-01, -02, …) with a few PINs each; the identifier bucket stops
-- a distributed attack on one child.
--
-- Keys are stored as SHA-256 hashes (pgcrypto, enabled in 0001), so the
-- table holds no emails, login codes or IP addresses in clear text.

create table if not exists auth_login_throttle (
  scope text not null check (scope in ('identifier', 'ip')),
  key_hash text not null,
  failures int not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  lock_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash)
);

-- app_user gets CRUD on new tables via default privileges (0003); take
-- it away again — only the security-definer functions below touch it.
revoke all on auth_login_throttle from app_user;
alter table auth_login_throttle enable row level security;
-- (no policies: even a grant by mistake would expose zero rows)

create or replace function auth_throttle_key(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(digest(lower(trim(coalesce(p_value, ''))), 'sha256'), 'hex');
$$;

-- When is this identifier/IP allowed to try again? NULL = now.
create or replace function auth_throttle_status(p_identifier text, p_ip text)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(locked_until)
  from auth_login_throttle
  where locked_until > now()
    and ((scope = 'identifier' and key_hash = auth_throttle_key(p_identifier))
      or (scope = 'ip' and p_ip is not null and key_hash = auth_throttle_key(p_ip)));
$$;

-- Records one failed attempt in both buckets; locks a bucket once it
-- reaches its failure limit inside its window. Repeated lockouts of the
-- same identifier double the lock (capped by p_max_lock_minutes) so a
-- slow, patient attacker doesn't get a fresh 5 tries every 15 minutes.
-- Returns the resulting lock time (NULL if not locked).
create or replace function auth_throttle_fail(
  p_identifier text,
  p_ip text,
  p_id_max_failures int,
  p_ip_max_failures int,
  p_window_minutes int,
  p_lock_minutes int,
  p_max_lock_minutes int
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_key text;
  v_max int;
  v_row auth_login_throttle;
  v_locked timestamptz;
  v_result timestamptz;
begin
  foreach v_scope in array array['identifier', 'ip'] loop
    if v_scope = 'ip' and p_ip is null then
      continue;
    end if;
    v_key := auth_throttle_key(case v_scope when 'identifier' then p_identifier else p_ip end);
    v_max := case v_scope when 'identifier' then p_id_max_failures else p_ip_max_failures end;

    insert into auth_login_throttle as t (scope, key_hash, failures, window_started_at, updated_at)
    values (v_scope, v_key, 1, now(), now())
    on conflict (scope, key_hash) do update
      set failures = case
            when t.window_started_at < now() - make_interval(mins => p_window_minutes) then 1
            else t.failures + 1
          end,
          window_started_at = case
            when t.window_started_at < now() - make_interval(mins => p_window_minutes) then now()
            else t.window_started_at
          end,
          updated_at = now()
    returning * into v_row;
    v_locked := v_row.locked_until;

    if v_row.failures >= v_max then
      update auth_login_throttle
      set locked_until = now() + make_interval(mins => least(
            p_max_lock_minutes,
            p_lock_minutes * power(2, least(v_row.lock_count, 10))::int
          )),
          lock_count = lock_count + 1,
          failures = 0,
          window_started_at = now()
      where scope = v_scope and key_hash = v_key
      returning locked_until into v_locked;
    end if;

    if v_locked > now() then
      v_result := greatest(coalesce(v_result, v_locked), v_locked);
    end if;
  end loop;

  -- Opportunistic cleanup keeps the table small without a cron job.
  if random() < 0.05 then
    delete from auth_login_throttle
    where updated_at < now() - interval '2 days'
      and (locked_until is null or locked_until < now());
  end if;

  return v_result;
end;
$$;

-- A successful login clears the identifier bucket (not the IP bucket:
-- one right guess must not reset an address that is scanning codes).
create or replace function auth_throttle_success(p_identifier text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth_login_throttle where scope = 'identifier' and key_hash = auth_throttle_key(p_identifier);
$$;

revoke all on function auth_throttle_key(text) from public;
revoke all on function auth_throttle_status(text, text) from public;
revoke all on function auth_throttle_fail(text, text, int, int, int, int, int) from public;
revoke all on function auth_throttle_success(text) from public;
grant execute on function auth_throttle_status(text, text) to app_user;
grant execute on function auth_throttle_fail(text, text, int, int, int, int, int) to app_user;
grant execute on function auth_throttle_success(text) to app_user;
