-- Functional/UX update (AI Studio publishing, research, greenhouse,
-- public homepage statistics). Strictly additive: no column is dropped,
-- no row is deleted or rewritten, and every new column is nullable or
-- has a default, so existing research projects, plants and growth
-- history keep behaving exactly as before.

-- ── Эко Зерттеу ────────────────────────────────────────────────────
-- Teachers can now save a project as a draft (hidden from children),
-- edit it, then publish it. Existing rows are 'active' or 'completed'
-- and stay that way — the default is still 'active'.
alter table research_projects drop constraint if exists research_projects_status_check;
alter table research_projects
  add constraint research_projects_status_check check (status in ('draft', 'active', 'completed'));

-- The child-facing steps of a project ("1. Суар", "2. Өлше" ...).
alter table research_projects add column if not exists tasks text[] not null default '{}';
alter table research_projects add column if not exists updated_at timestamptz not null default now();

-- ── Жасыл бөбекжай ─────────────────────────────────────────────────
-- Key into the code-side plant catalog (src/lib/domain/plant-catalog.ts:
-- flowers, trees, vegetables, other). NULL for every pre-existing plant,
-- which the UI shows with the generic sprout — nothing is backfilled.
alter table greenhouse_entries add column if not exists plant_key text;

-- Picture-based observations for children who can't type a number:
-- "how many leaves" (tapped from 1–5 leaf pictures) and the growth
-- stage. height_cm stays for older children and old logs.
alter table growth_logs add column if not exists leaf_count smallint;
alter table growth_logs drop constraint if exists growth_logs_leaf_count_check;
alter table growth_logs add constraint growth_logs_leaf_count_check check (leaf_count is null or leaf_count between 0 and 20);
alter table growth_logs add column if not exists stage text;

-- ── Public homepage statistics ─────────────────────────────────────
-- The homepage is anonymous, so RLS (correctly) lets it read nothing
-- from users/recognitions/etc. Instead of opening any of those tables
-- or exposing an admin endpoint, this one security-definer function
-- returns platform-wide COUNTS only — no ids, names, photos, schools
-- or per-child rows — and excludes seeded demo accounts so the numbers
-- are real. Same pattern as auth_lookup_credentials (0004).
create or replace function public_platform_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with real_users as (
    select id, school_id, role from users where not is_demo and role <> 'SUPER_ADMIN'
  ),
  real_children as (
    select id from real_users where role = 'CHILD'
  )
  select json_build_object(
    'kindergartens', (select count(distinct school_id) from real_users),
    'children', (select count(*) from real_users where role = 'CHILD'),
    'teachers', (select count(*) from real_users where role = 'TEACHER'),
    'parents', (select count(*) from real_users where role = 'PARENT'),
    'modules', json_build_object(
      'ecolab', (
        select json_build_object('actions', count(*), 'users', count(distinct r.child_id),
                                 'actions30d', count(*) filter (where r.created_at > now() - interval '30 days'))
        from recognitions r where r.child_id in (select id from real_children)
      ),
      'greenhouse', (
        select json_build_object('actions', count(*), 'users', count(distinct e.child_id),
                                 'actions30d', count(*) filter (where e.created_at > now() - interval '30 days'))
        from greenhouse_entries e where e.child_id in (select id from real_children)
      ),
      'game', (
        select json_build_object('actions', count(*), 'users', count(distinct gs.child_id),
                                 'actions30d', count(*) filter (where gs.ended_at > now() - interval '30 days'))
        from game_sessions gs where gs.ended_at is not null and gs.child_id in (select id from real_children)
      ),
      'media', (
        select json_build_object('actions', count(*), 'users', count(distinct m.created_by),
                                 'actions30d', count(*) filter (where m.created_at > now() - interval '30 days'))
        from media_assets m where m.created_by in (select id from real_users)
      ),
      'research', (
        select json_build_object('actions', count(*), 'users', count(distinct o.child_id),
                                 'actions30d', count(*) filter (where o.created_at > now() - interval '30 days'))
        from research_observations o where o.child_id in (select id from real_children)
      ),
      'passport', (
        select json_build_object('actions', count(*), 'users', count(distinct ca.child_id),
                                 'actions30d', count(*) filter (where ca.earned_at > now() - interval '30 days'))
        from child_achievements ca where ca.child_id in (select id from real_children)
      ),
      'family', (
        select json_build_object('actions', count(*), 'users', count(distinct l.parent_id),
                                 'actions30d', count(*) filter (where l.created_at > now() - interval '30 days'))
        from parent_child_links l where l.parent_id in (select id from real_users)
      ),
      'analytics', (
        select json_build_object('actions', count(*), 'users', count(distinct l.author_id),
                                 'actions30d', count(*) filter (where l.created_at > now() - interval '30 days'))
        from lessons l where l.author_id in (select id from real_users)
      )
    )
  );
$$;

revoke all on function public_platform_stats() from public;
grant execute on function public_platform_stats() to app_user;
