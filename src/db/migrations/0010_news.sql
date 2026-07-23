-- Homepage news carousel + full News CMS.
--
-- The public homepage hero used to show a generic marketing banner
-- carousel (homepage_banners, 0009) — that table/CMS tab/component is
-- left fully intact (no destructive change) but the hero slot now
-- renders news instead. News is a distinct editorial content type
-- administered from its own SUPER_ADMIN section, so it gets its own
-- table rather than folding into the homepage-design bundle.
--
-- Same admin-created-freely / group_id-linked draft+published shape as
-- homepage_banners (see that migration's header comment for the full
-- rationale) — but plain kk-only text columns, not the jsonb
-- {kk,ru,en} shape used for UI-string content, since this is real
-- editorial copy, not a translated interface string.

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null default gen_random_uuid(),
  status content_status not null default 'draft',
  enabled boolean not null default true,
  featured_home boolean not null default false,
  display_order int not null default 0,
  slug text not null,
  title text not null default '',
  excerpt text not null default '',
  body text not null default '',
  category text not null default 'announcements'
    check (category in ('events','eco_projects','child_achievements','teacher_news','for_parents','announcements')),
  author text not null default '',
  display_date timestamptz not null default now(),
  main_image_url text,
  gallery_urls jsonb not null default '[]',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  published_at timestamptz
);
create unique index if not exists news_items_group_status on news_items(group_id, status);
create unique index if not exists news_items_slug_published on news_items(slug) where status = 'published';
create index if not exists idx_news_items_home on news_items(status, featured_home, display_order) where status = 'published';

alter table news_items enable row level security;
drop policy if exists public_read_published on news_items;
create policy public_read_published on news_items for select using (status = 'published');
drop policy if exists super_admin_full_access on news_items;
create policy super_admin_full_access on news_items for all
  using (app_is_super_admin()) with check (app_is_super_admin());

-- Media library: news images need their own "kind" tag alongside the
-- existing ones, same pattern as 0008's games_template_check widening.
alter table site_media drop constraint if exists site_media_kind_check;
alter table site_media
  add constraint site_media_kind_check check (
    kind in ('logo','favicon','banner','section','module','icon','news','other')
  );
