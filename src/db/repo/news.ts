import "server-only";
import { withSystemContext, withTenantContext, type TenantContext } from "@/db/client";
import {
  listDrafts,
  listPublished,
  logPublish,
  logRevision,
  wrapJsonFields,
  type ContentStatus,
} from "@/db/repo/cms-core";

// ── News (list, admin-created — no fixed key) ───────────────────────
//
// Same group_id-linked draft/published shape as the homepage banner
// carousel (src/db/repo/cms.ts) — news articles are freely created and
// deleted by SUPER_ADMIN, so there's no fixed enum to key by. Unlike
// banner content, these are plain kk-only columns (real editorial
// copy), not a jsonb {kk,ru,en} UI-string shape.

export { NEWS_CATEGORIES, type NewsCategory } from "@/lib/news-categories";
import type { NewsCategory } from "@/lib/news-categories";

export type NewsItemRow = {
  id: string;
  group_id: string;
  status: ContentStatus;
  enabled: boolean;
  featured_home: boolean;
  display_order: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: NewsCategory;
  author: string;
  display_date: string;
  main_image_url: string | null;
  gallery_urls: string[];
  version: number;
  updated_at: string;
  published_at: string | null;
  view_count: number;
};

const NEWS_JSON_FIELDS = ["gallery_urls"];

export const listPublishedNews = () => listPublished<NewsItemRow>("news_items", "display_date");
export const listDraftNews = (ctx: TenantContext) => listDrafts<NewsItemRow>(ctx, "news_items", "display_date");

export async function listNewsGroupIds(ctx: TenantContext): Promise<string[]> {
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<{ group_id: string }[]>`select distinct group_id from news_items order by group_id`;
    return rows.map((r) => r.group_id);
  });
}

export async function getPublishedNewsBySlug(slug: string): Promise<NewsItemRow | null> {
  return withSystemContext(async (sql) => {
    const rows = await sql<NewsItemRow[]>`
      select * from news_items where slug = ${slug} and status = 'published' limit 1
    `;
    return rows[0] ?? null;
  });
}

/** Fire-and-forget view counter, called once per article-page render —
 * best-effort only, never blocks or fails the page (a lost view count
 * is harmless, unlike a broken article page). */
export async function incrementNewsViewCount(slug: string): Promise<void> {
  await withSystemContext(async (sql) => {
    await sql`update news_items set view_count = view_count + 1 where slug = ${slug} and status = 'published'`;
  });
}

/** The previous/next published article by display_date, for the
 * article page's "алдыңғы/келесі жаңалық" navigation. */
export async function getPublishedNewsNeighbors(
  slug: string
): Promise<{ prev: NewsItemRow | null; next: NewsItemRow | null }> {
  return withSystemContext(async (sql) => {
    const [current] = await sql<{ display_date: string }[]>`
      select display_date from news_items where slug = ${slug} and status = 'published' limit 1
    `;
    if (!current) return { prev: null, next: null };
    const [prevRows, nextRows] = await Promise.all([
      sql<NewsItemRow[]>`
        select * from news_items where status = 'published' and display_date < ${current.display_date}
        order by display_date desc limit 1
      `,
      sql<NewsItemRow[]>`
        select * from news_items where status = 'published' and display_date > ${current.display_date}
        order by display_date asc limit 1
      `,
    ]);
    return { prev: prevRows[0] ?? null, next: nextRows[0] ?? null };
  });
}

export async function createNewsDraft(ctx: TenantContext): Promise<NewsItemRow> {
  return withTenantContext(ctx, async (sql) => {
    const [{ max }] = await sql<{ max: number | null }[]>`select max(display_order) as max from news_items`;
    const slug = `zhanalyk-${Date.now().toString(36)}`;
    const [created] = await sql<NewsItemRow[]>`
      insert into news_items (status, display_order, slug, created_by, updated_by)
      values ('draft', ${(max ?? -1) + 1}, ${slug}, ${ctx.userId}, ${ctx.userId})
      returning *
    `;
    return created;
  });
}

/** Creates the draft row for a news group if it doesn't exist yet, cloning the published one. */
export async function ensureNewsDraft(ctx: TenantContext, groupId: string): Promise<NewsItemRow> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<NewsItemRow[]>`
      select * from news_items where group_id = ${groupId} and status = 'draft' limit 1
    `;
    if (existing[0]) return existing[0];

    const published = await sql<Record<string, unknown>[]>`
      select * from news_items where group_id = ${groupId} and status = 'published' limit 1
    `;
    if (!published[0]) throw new Error(`No news item found for group ${groupId}`);
    const { id: _id, status: _status, published_at: _pub, ...rest } = published[0];
    void _id;
    void _status;
    void _pub;
    const [created] = await sql<NewsItemRow[]>`
      insert into news_items ${sql(wrapJsonFields(sql, { ...rest, status: "draft" }, NEWS_JSON_FIELDS))}
      returning *
    `;
    return created;
  });
}

export async function saveNewsDraft(
  ctx: TenantContext,
  groupId: string,
  patch: Partial<
    Omit<NewsItemRow, "id" | "group_id" | "status" | "version" | "updated_at" | "published_at" | "gallery_urls"> & {
      gallery_urls?: string[];
    }
  >
) {
  await ensureNewsDraft(ctx, groupId);
  await withTenantContext(ctx, (sql) =>
    sql`
      update news_items
      set ${sql(
        wrapJsonFields(sql, { ...patch, updated_at: new Date().toISOString(), updated_by: ctx.userId }, NEWS_JSON_FIELDS)
      )}, version = version + 1
      where group_id = ${groupId} and status = 'draft'
    `
  );
}

export async function publishNews(ctx: TenantContext, groupId: string) {
  await withTenantContext(ctx, async (sql) => {
    const [draft] = await sql<Record<string, unknown>[]>`
      select * from news_items where group_id = ${groupId} and status = 'draft' limit 1
    `;
    if (!draft) throw new Error(`No draft news item for group ${groupId}`);
    const {
      id: _id,
      status: _status,
      created_at,
      created_by,
      published_at: _pub,
      version,
      group_id: _gid,
      ...content
    } = draft;
    void _id;
    void _status;
    void _pub;
    void created_at;
    void created_by;
    void _gid;

    const [existing] = await sql<{ id: string }[]>`
      select id from news_items where group_id = ${groupId} and status = 'published' limit 1
    `;
    if (existing) {
      await sql`
        update news_items
        set ${sql(
          wrapJsonFields(
            sql,
            { ...content, updated_at: new Date().toISOString(), updated_by: ctx.userId, published_at: new Date().toISOString() },
            NEWS_JSON_FIELDS
          )
        )}
        where id = ${existing.id}
      `;
      await logRevision(sql, "news_items", existing.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "news_items", existing.id, ctx.userId, "news");
    } else {
      const [created] = await sql<{ id: string }[]>`
        insert into news_items ${sql(
          wrapJsonFields(
            sql,
            {
              ...content,
              group_id: groupId,
              status: "published",
              published_at: new Date().toISOString(),
              created_by: ctx.userId,
              updated_by: ctx.userId,
            },
            NEWS_JSON_FIELDS
          )
        )}
        returning id
      `;
      await logRevision(sql, "news_items", created.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "news_items", created.id, ctx.userId, "news");
    }
  });
}

/** Removes only the published row, leaving the draft intact so editing
 * can continue — distinct from deleteNews, which removes both. This is
 * the "жарияланымды тоқтату" (stop publishing) action the spec asks
 * for as separate from delete. */
export async function unpublishNews(ctx: TenantContext, groupId: string) {
  await withTenantContext(ctx, (sql) =>
    sql`delete from news_items where group_id = ${groupId} and status = 'published'`
  );
}

export async function deleteNews(ctx: TenantContext, groupId: string) {
  await withTenantContext(ctx, (sql) => sql`delete from news_items where group_id = ${groupId}`);
}

export async function reorderFeaturedNews(ctx: TenantContext, orderedGroupIds: string[]) {
  await withTenantContext(ctx, async (sql) => {
    for (let i = 0; i < orderedGroupIds.length; i++) {
      await sql`
        update news_items set display_order = ${i}
        where group_id = ${orderedGroupIds[i]} and status = 'draft'
      `;
    }
  });
}
