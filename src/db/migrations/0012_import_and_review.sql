-- Production data cutover support: idempotent-import tracking, the
-- "needs review" state for Excel rows that can't be safely auto-resolved
-- (a child listed under two different groups), a parent phone field
-- (nullable — never fabricated, only ever set if a future real source
-- provides it), and a view counter for news articles.
--
-- All-additive, matches every prior migration's convention this
-- session: nullable-or-defaulted new columns, existing rows unaffected.

alter table users
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_note jsonb,
  add column if not exists source_import_key text,
  add column if not exists phone text;

-- Lets the import script safely upsert ("insert ... on conflict") by a
-- deterministic per-Excel-row key instead of re-deriving unstable
-- values (login codes, generated emails) to detect "this already
-- exists" — the actual mechanism that makes re-running the import
-- idempotent. Partial (where not null) so existing/non-imported rows
-- (SUPER_ADMIN, SCHOOL_ADMIN) are never forced to have one.
create unique index if not exists users_source_import_key_unique
  on users(source_import_key) where source_import_key is not null;

alter table groups add column if not exists source_import_key text;
create unique index if not exists groups_source_import_key_unique
  on groups(source_import_key) where source_import_key is not null;

alter table news_items add column if not exists view_count int not null default 0;
