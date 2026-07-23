-- Website Design & Homepage CMS.
--
-- These tables are platform-wide (no school_id) — unlike every other
-- table in the schema, the public homepage must be able to read the
-- *published* rows with NO session at all (an anonymous visitor has no
-- JWT, no GUCs set). So RLS here is two permissive policies per table,
-- which Postgres OR's together: "anyone may select published rows" and
-- "SUPER_ADMIN may do anything, including read drafts". See
-- docs/ARCHITECTURE.md "CMS: draft/publish model" for the write path.
--
-- Draft/publish pattern: singleton content (brand, theme, banner) has
-- at most one 'draft' row and at most one 'published' row, enforced by
-- a partial unique index on (status). List content (sections, modules,
-- role cards) has at most one 'draft' and one 'published' row *per
-- key*. Editing always writes the draft; "Publish" copies draft ->
-- published inside a transaction, so the live site never briefly sees
-- a half-written row, and the previously-published row is never
-- deleted mid-edit — only overwritten atomically at publish time.

create type content_status as enum ('draft', 'published');

-- ── Branding (singleton) ─────────────────────────────────────────────

create table if not exists brand_settings (
  id uuid primary key default gen_random_uuid(),
  status content_status not null default 'draft',
  site_name text not null default 'Eco Start AI',
  short_name text not null default 'Eco Start',
  logo_url text,
  logo_dark_url text,
  favicon_url text,
  footer_logo_url text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  published_at timestamptz
);
create unique index if not exists brand_settings_one_per_status on brand_settings(status);

-- ── Theme (singleton) ─────────────────────────────────────────────────

create table if not exists theme_settings (
  id uuid primary key default gen_random_uuid(),
  status content_status not null default 'draft',
  color_primary text not null default 'oklch(0.52 0.13 152)',
  color_secondary text not null default 'oklch(0.94 0.03 200)',
  color_accent text not null default 'oklch(0.55 0.13 220)',
  color_background text not null default 'oklch(0.99 0.006 145)',
  color_card text not null default 'oklch(1 0 0)',
  color_foreground text not null default 'oklch(0.22 0.03 155)',
  color_muted_foreground text not null default 'oklch(0.48 0.03 155)',
  color_success text not null default 'oklch(0.6 0.15 152)',
  color_warning text not null default 'oklch(0.78 0.15 80)',
  color_danger text not null default 'oklch(0.6 0.21 26)',
  radius text not null default '1rem',
  button_radius text not null default '0.75rem',
  card_shadow text not null default 'soft',
  font_family text not null default 'Nunito',
  heading_font text not null default 'Comfortaa',
  body_font text not null default 'Nunito',
  illustration_style text not null default 'friendly-nature',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  published_at timestamptz
);
create unique index if not exists theme_settings_one_per_status on theme_settings(status);

-- ── Homepage banner (singleton) ────────────────────────────────────────

create table if not exists homepage_banner (
  id uuid primary key default gen_random_uuid(),
  status content_status not null default 'draft',
  enabled boolean not null default true,
  content jsonb not null default '{}', -- { kk: {title,subtitle,description,primaryButtonText,secondaryButtonText}, ru: {...}, en: {...} }
  desktop_image_url text,
  mobile_image_url text,
  background_image_url text,
  video_url text,
  overlay_strength numeric(3,2) not null default 0.35,
  text_align text not null default 'left' check (text_align in ('left','center','right')),
  content_position text not null default 'left' check (content_position in ('left','center','right')),
  primary_button_link text not null default '/login',
  secondary_button_link text,
  start_at timestamptz,
  end_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  published_at timestamptz
);
create unique index if not exists homepage_banner_one_per_status on homepage_banner(status);

-- ── Homepage sections (list, keyed) ─────────────────────────────────────

create table if not exists homepage_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key in ('hero','intro','modules','eco_ai','roles','results','cta','footer')),
  status content_status not null default 'draft',
  enabled boolean not null default true,
  display_order int not null default 0,
  content jsonb not null default '{}', -- { kk: {title,subtitle,description,buttonText}, ru: {...}, en: {...} }
  image_url text,
  icon text,
  button_link text,
  background_style text not null default 'default' check (background_style in ('default','muted','primary','gradient')),
  layout text not null default 'standard' check (layout in ('standard','reverse','centered','grid')),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  published_at timestamptz
);
create unique index if not exists homepage_sections_key_status on homepage_sections(key, status);

-- ── Homepage module cards (list, keyed) ──────────────────────────────────

create table if not exists homepage_modules (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key in ('ecolab','greenhouse','game','media','research','passport','family','analytics')),
  status content_status not null default 'draft',
  enabled boolean not null default true,
  display_order int not null default 0,
  icon text not null default 'Sparkles',
  color text not null default 'var(--primary)',
  image_url text,
  content jsonb not null default '{}', -- { kk: {title,description}, ru: {...}, en: {...} }
  route text not null,
  allowed_roles jsonb not null default '["CHILD"]', -- array of Role strings
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  published_at timestamptz
);
create unique index if not exists homepage_modules_key_status on homepage_modules(key, status);

-- ── Homepage role cards (list, keyed) ─────────────────────────────────────

create table if not exists homepage_role_cards (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key in ('CHILD','TEACHER','PARENT','SCHOOL_ADMIN')),
  status content_status not null default 'draft',
  enabled boolean not null default true,
  display_order int not null default 0,
  icon text not null default 'User',
  color text not null default 'var(--primary)',
  content jsonb not null default '{}', -- { kk: {title,description}, ru: {...}, en: {...} }
  route text not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  published_at timestamptz
);
create unique index if not exists homepage_role_cards_key_status on homepage_role_cards(key, status);

-- ── Media library (CMS-managed site assets, distinct from product media_assets) ──

create table if not exists site_media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('logo','favicon','banner','section','module','icon','other')),
  url text not null,
  file_name text not null,
  content_type text not null,
  size_bytes int not null,
  alt jsonb not null default '{}', -- { kk, ru, en }
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Revisions & publish history (audit trail for the CMS itself) ──────────

create table if not exists content_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  snapshot jsonb not null,
  version int not null,
  edited_by uuid references users(id) on delete set null,
  edited_at timestamptz not null default now()
);
create index if not exists idx_content_revisions_entity on content_revisions(entity_type, entity_id, edited_at desc);

create table if not exists publish_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  note text,
  published_by uuid references users(id) on delete set null,
  published_at timestamptz not null default now()
);
create index if not exists idx_publish_history_time on publish_history(published_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'brand_settings','theme_settings','homepage_banner','homepage_sections',
    'homepage_modules','homepage_role_cards'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists public_read_published on %I', t);
    execute format(
      'create policy public_read_published on %I for select using (status = ''published'')', t
    );
    execute format('drop policy if exists super_admin_full_access on %I', t);
    execute format(
      'create policy super_admin_full_access on %I for all using (app_is_super_admin()) with check (app_is_super_admin())', t
    );
  end loop;

  for t in select unnest(array['site_media', 'content_revisions', 'publish_history'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists super_admin_only on %I', t);
    execute format(
      'create policy super_admin_only on %I for all using (app_is_super_admin()) with check (app_is_super_admin())', t
    );
  end loop;
end $$;
