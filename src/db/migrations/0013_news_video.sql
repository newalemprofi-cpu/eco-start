-- Optional video support for news items, alongside the existing
-- main_image_url / gallery_urls columns (0010_news.sql). Additive and
-- nullable/defaulted, so every existing news row stays valid without
-- a backfill: main_video_url defaults to null (no video), video_urls
-- defaults to an empty jsonb array (same shape/convention as
-- gallery_urls). No binary video data is ever stored here — only the
-- URL the storage adapter returned when the file was written under
-- UPLOAD_ROOT (see src/lib/cms/upload.ts::uploadNewsVideo).
alter table news_items
  add column if not exists main_video_url text,
  add column if not exists video_urls jsonb not null default '[]';
