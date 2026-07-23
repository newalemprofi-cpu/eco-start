-- Row Level Security — defense in depth beneath the application layer.
--
-- We do not use Supabase's `auth.jwt()` (that function only exists once
-- Supabase's own Auth/GoTrue schema is installed, which local Docker
-- Postgres does not have). Instead we use three transaction-local
-- Postgres settings that the app sets on every authenticated database
-- call (see src/db/client.ts -> withTenantContext). This pattern works
-- identically against local Docker Postgres and a hosted Supabase
-- Postgres instance, which is why it was chosen — see
-- docs/ARCHITECTURE.md "Database access & RLS".

create or replace function app_current_school_id() returns uuid as $$
  select nullif(current_setting('app.current_school_id', true), '')::uuid
$$ language sql stable;

create or replace function app_current_user_id() returns uuid as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$ language sql stable;

create or replace function app_current_role() returns text as $$
  select nullif(current_setting('app.current_role', true), '')
$$ language sql stable;

create or replace function app_is_super_admin() returns boolean as $$
  select app_current_role() = 'SUPER_ADMIN'
$$ language sql stable;

-- Tenant isolation: every school-scoped table is only visible to
-- callers whose session GUC matches that school, or to super admins.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'users','groups','recognitions','greenhouse_entries','growth_logs',
      'game_sessions','child_achievements','certificates','research_projects',
      'research_observations','lessons','lesson_artifacts','lesson_assignments',
      'media_assets','notifications','chat_threads','chat_messages',
      'ai_logs','audit_logs'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
  end loop;
end $$;

alter table schools enable row level security;
drop policy if exists schools_visibility on schools;
create policy schools_visibility on schools
  for select using (id = app_current_school_id() or app_is_super_admin());

create policy tenant_isolation on users
  using (school_id = app_current_school_id() or app_is_super_admin() or id = app_current_user_id());

create policy tenant_isolation on groups
  using (school_id = app_current_school_id() or app_is_super_admin());

create policy tenant_isolation on recognitions
  using (
    app_is_super_admin() or exists (
      select 1 from users u where u.id = recognitions.child_id and u.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on greenhouse_entries
  using (
    app_is_super_admin() or exists (
      select 1 from users u where u.id = greenhouse_entries.child_id and u.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on growth_logs
  using (
    app_is_super_admin() or exists (
      select 1 from greenhouse_entries g
      join users u on u.id = g.child_id
      where g.id = growth_logs.entry_id and u.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on game_sessions
  using (
    app_is_super_admin() or exists (
      select 1 from users u where u.id = game_sessions.child_id and u.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on child_achievements
  using (
    app_is_super_admin() or exists (
      select 1 from users u where u.id = child_achievements.child_id and u.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on certificates
  using (school_id = app_current_school_id() or app_is_super_admin());

create policy tenant_isolation on research_projects
  using (
    app_is_super_admin() or exists (
      select 1 from groups g where g.id = research_projects.group_id and g.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on research_observations
  using (
    app_is_super_admin() or exists (
      select 1 from research_projects p
      join groups g on g.id = p.group_id
      where p.id = research_observations.project_id and g.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on lessons
  using (school_id = app_current_school_id() or app_is_super_admin());

create policy tenant_isolation on lesson_artifacts
  using (
    app_is_super_admin() or exists (
      select 1 from lessons l where l.id = lesson_artifacts.lesson_id and l.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on lesson_assignments
  using (
    app_is_super_admin() or exists (
      select 1 from groups g where g.id = lesson_assignments.group_id and g.school_id = app_current_school_id()
    )
  );

create policy tenant_isolation on media_assets
  using (school_id = app_current_school_id() or app_is_super_admin());

create policy tenant_isolation on notifications
  using (user_id = app_current_user_id() or app_is_super_admin());

create policy tenant_isolation on chat_threads
  using (user_id = app_current_user_id() or app_is_super_admin());

create policy tenant_isolation on chat_messages
  using (
    app_is_super_admin() or exists (
      select 1 from chat_threads t where t.id = chat_messages.thread_id and t.user_id = app_current_user_id()
    )
  );

create policy tenant_isolation on ai_logs
  using (school_id = app_current_school_id() or app_is_super_admin());

create policy tenant_isolation on audit_logs
  using (school_id = app_current_school_id() or app_is_super_admin());
