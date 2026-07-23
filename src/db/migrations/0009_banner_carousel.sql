-- Homepage banner carousel.
--
-- The original `homepage_banner` table (0006_cms.sql) is a singleton —
-- at most one draft row and one published row, ever. The homepage needs
-- a real multi-banner rotating carousel instead, which doesn't fit that
-- shape. Rather than migrate the singleton in place (risky: it's live
-- CMS data), this adds a new list-based table alongside it, modeled
-- directly on `homepage_sections` (draft/publish per logical row,
-- `display_order`, `enabled`). The old table is left untouched and
-- simply stops being read by the public page / admin UI once the
-- carousel ships — see docs/ARCHITECTURE.md.
--
-- Unlike `homepage_sections`/`homepage_modules` (a fixed, small enum of
-- keys baked into a check constraint), banners are freely created and
-- deleted by an admin, so there's no fixed key to check against.
-- `group_id` plays that role instead: assigned once when a banner is
-- first created as a draft, and carried over to its published
-- counterpart row, so the two rows for "the same banner" stay linked
-- across the draft -> publish lifecycle exactly the way `key` links
-- draft/published `homepage_sections` rows.

create table if not exists homepage_banners (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null default gen_random_uuid(),
  status content_status not null default 'draft',
  enabled boolean not null default true,
  display_order int not null default 0,
  content jsonb not null default '{}', -- { kk: {title,subtitle,description,primaryButtonText,secondaryButtonText}, ru: {...}, en: {...} }
  desktop_image_url text,
  mobile_image_url text,
  background_video_url text,
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
create unique index if not exists homepage_banners_group_status on homepage_banners(group_id, status);
create index if not exists idx_homepage_banners_display_order on homepage_banners(status, display_order);

alter table homepage_banners enable row level security;
drop policy if exists public_read_published on homepage_banners;
create policy public_read_published on homepage_banners for select using (status = 'published');
drop policy if exists super_admin_full_access on homepage_banners;
create policy super_admin_full_access on homepage_banners for all
  using (app_is_super_admin()) with check (app_is_super_admin());
