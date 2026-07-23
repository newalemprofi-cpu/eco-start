-- Groups (kindergarten classes) management + age-category content linking.
--
-- The `groups` table (0001_init.sql) has existed since the very first
-- migration — teacher rosters, research projects and lesson assignments
-- already scope work to a group_id — but it has never had an admin CRUD
-- surface: it was only ever populated by scripts/seed.ts. This migration
-- widens `groups` with the operational fields a real admin UI needs
-- (unique code, a fixed 3-tier age category, educator/assistant,
-- active/archived lifecycle) and adds an `age_categories` array to the
-- two content tables that already have a genuine catalog/template shape
-- (games, lessons) so a child only sees content matching their group's
-- age. All-additive: every new column has a safe default, so existing
-- rows (the seed demo group, the 15 seeded games) keep behaving exactly
-- as before until an admin explicitly narrows something.

create type group_age_category as enum ('MIDDLE_3', 'SENIOR_4', 'PRESCHOOL_5');

alter table groups
  add column if not exists code text,
  add column if not exists age_category group_age_category not null default 'PRESCHOOL_5',
  add column if not exists educator_id uuid references users(id) on delete set null,
  add column if not exists pedagogical_assistant_id uuid references users(id) on delete set null,
  add column if not exists child_count int not null default 0,
  add column if not exists description text not null default '',
  add column if not exists academic_year text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Backfill a unique code for any pre-existing (seed) rows before the
-- column can be made required — scripts/seed.ts assigns real codes to
-- its own demo groups on rerun, this is only a safety net for rows that
-- predate this migration.
update groups set code = 'GRP-' || substr(id::text, 1, 8) where code is null;
alter table groups alter column code set not null;
create unique index if not exists groups_code_unique on groups(code);

create index if not exists idx_groups_educator on groups(educator_id);
create index if not exists idx_groups_age_category on groups(age_category);

-- Empty array = "барлық санат" (shown to every age) — the correct
-- backward-compatible default, since every existing game/lesson has
-- always been shown to all children; nothing changes until an admin
-- explicitly narrows a specific game/lesson's categories.
alter table games add column if not exists age_categories group_age_category[] not null default '{}';
alter table lessons add column if not exists age_categories group_age_category[] not null default '{}';
