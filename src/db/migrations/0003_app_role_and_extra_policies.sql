-- Principle of least privilege: the running application never connects
-- with the migration/seed superuser. It connects as `app_user`, a plain
-- role with row-level-security-enforced access. This is what makes the
-- policies in 0002_rls.sql actually bite locally (a superuser bypasses
-- RLS by default, which is why migrations/seed run as the bootstrap
-- Docker user but the Next.js app does not — see docs/ARCHITECTURE.md).
-- Split into "create the role if missing" + "always (re)apply the
-- password" on purpose. A bare `if not exists (...) then create role
-- ... password '...'` only sets the password at role-creation time —
-- if app_user already exists in the volume (e.g. from an earlier
-- partial run), the password clause is silently skipped and Postgres
-- keeps whatever password the role had before, which can drift out of
-- sync with DATABASE_URL/.env and produce
-- "password authentication failed for user \"app_user\"" even though
-- every config file agrees on the value. Running `alter role ...
-- with password` unconditionally, every time this migration applies,
-- makes the migration file the single source of truth for that
-- password regardless of the role's prior state.
do $$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user login nosuperuser nocreatedb nocreaterole;
  end if;
end $$;

alter role app_user with password 'app_user_dev_password';

grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
alter default privileges in schema public grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public grant usage, select on sequences to app_user;

-- Remaining tenant-relevant tables not covered by the generic loop in
-- 0002_rls.sql (they have a slightly different ownership shape).
alter table parent_child_links enable row level security;
drop policy if exists tenant_isolation on parent_child_links;
create policy tenant_isolation on parent_child_links
  using (
    app_is_super_admin()
    or parent_id = app_current_user_id()
    or exists (select 1 from users u where u.id = parent_child_links.child_id and u.school_id = app_current_school_id())
  );

alter table teacher_groups enable row level security;
drop policy if exists tenant_isolation on teacher_groups;
create policy tenant_isolation on teacher_groups
  using (
    app_is_super_admin()
    or teacher_id = app_current_user_id()
    or exists (select 1 from groups g where g.id = teacher_groups.group_id and g.school_id = app_current_school_id())
  );

-- Species / games / achievements are global curated reference content:
-- readable by any authenticated session, writable only by platform
-- operators (enforced at the application layer for SUPER_ADMIN routes;
-- RLS here just guarantees no anonymous/unauthenticated read).
alter table species enable row level security;
drop policy if exists read_reference_data on species;
create policy read_reference_data on species for select using (app_current_role() is not null);

alter table games enable row level security;
drop policy if exists read_reference_data on games;
create policy read_reference_data on games for select using (app_current_role() is not null);

alter table achievements enable row level security;
drop policy if exists read_reference_data on achievements;
create policy read_reference_data on achievements for select using (app_current_role() is not null);
