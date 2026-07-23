-- Login has to look up a user (including their password/PIN hash)
-- *before* any session/tenant context exists, which is exactly what
-- RLS on `users` is designed to prevent. Rather than weakening the
-- policy, we expose one narrow, `security definer` function that runs
-- with the schema owner's privileges (bypassing RLS internally) but
-- only ever returns the columns login actually needs, for a single
-- identifier. `app_user` may execute it but cannot otherwise read
-- arbitrary rows from `users` without a matching tenant context.
create or replace function auth_lookup_credentials(p_identifier text)
returns table (
  id uuid,
  school_id uuid,
  role text,
  password_hash text,
  pin_hash text,
  display_name text,
  avatar_url text,
  locale text,
  group_id uuid
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.school_id, u.role, u.password_hash, u.pin_hash,
         u.display_name, u.avatar_url, u.locale, u.group_id
  from users u
  where u.email = p_identifier or u.login_code = p_identifier
  limit 1;
$$;

revoke all on function auth_lookup_credentials(text) from public;
grant execute on function auth_lookup_credentials(text) to app_user;

-- Called after a successful password/PIN check to stamp last_login_at
-- without needing a tenant context yet (the session cookie isn't set
-- until after this call returns).
create or replace function auth_record_login(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update users set last_login_at = now() where id = p_user_id;
$$;

revoke all on function auth_record_login(uuid) from public;
grant execute on function auth_record_login(uuid) to app_user;
