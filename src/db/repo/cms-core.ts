import "server-only";
import type postgres from "postgres";
import { withSystemContext, withTenantContext, type TenantContext } from "@/db/client";

export type ContentStatus = "draft" | "published";
export type LocalizedText = { kk: string; ru: string; en: string };

/**
 * Shared plumbing for the CMS draft/publish pattern (see
 * src/db/migrations/0006_cms.sql). Every content table has the same
 * shape of concern — "get the live row", "get the row an admin is
 * editing", "atomically promote draft -> published without ever
 * deleting the previously-published row mid-edit" — so that logic
 * lives here once; per-entity files in src/db/repo/cms.ts stay focused
 * on each entity's actual fields.
 *
 * A gotcha worth flagging: postgres.js does NOT automatically know a
 * plain JS object headed for a `jsonb` column needs JSON-encoding when
 * it's built via the dynamic `sql({...obj})` insert/update helper (only
 * `select`-ing a jsonb column parses it back into an object — the
 * reverse direction needs an explicit hint). Manually calling
 * `JSON.stringify()` first is *wrong* — postgres.js's own serializer
 * then double-encodes it into a jsonb value that itself contains a JSON
 * string, not an object (caught via a real round-trip test against
 * Postgres, see scripts/seed.ts history). The fix used everywhere below
 * is `sql.json(value)`, which explicitly and correctly marks a value as
 * JSON for the parameter serializer — every function here that touches
 * a jsonb column takes a `jsonFields` list so callers don't have to
 * remember this.
 */

function wrapJsonFields(
  sql: postgres.TransactionSql,
  obj: Record<string, unknown>,
  jsonFields: string[]
): Record<string, unknown> {
  if (jsonFields.length === 0) return obj;
  const out = { ...obj };
  for (const field of jsonFields) {
    if (field in out && out[field] !== undefined) {
      out[field] = sql.json(out[field] as unknown as postgres.JSONValue);
    }
  }
  return out;
}

export async function getPublishedSingleton<T extends Record<string, unknown>>(
  table: string
): Promise<T | null> {
  const rows = await withSystemContext(
    (sql) => sql<T[]>`select * from ${sql(table)} where status = 'published' limit 1`
  );
  return rows[0] ?? null;
}

export async function getDraftSingleton<T extends Record<string, unknown>>(
  ctx: TenantContext,
  table: string
): Promise<T | null> {
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<T[]>`select * from ${sql(table)} where status = 'draft' limit 1`;
    return rows[0] ?? null;
  });
}

/**
 * Ensures a draft row exists — cloning the published row as a starting
 * point the first time someone opens the editor, or creating an empty
 * default-valued row if nothing has ever been published. Never touches
 * the published row.
 */
export async function ensureDraftSingleton<T extends Record<string, unknown> & { id: string }>(
  ctx: TenantContext,
  table: string,
  jsonFields: string[] = []
): Promise<T> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<T[]>`select * from ${sql(table)} where status = 'draft' limit 1`;
    if (existing[0]) return existing[0];

    const published = await sql<Record<string, unknown>[]>`
      select * from ${sql(table)} where status = 'published' limit 1
    `;
    if (published[0]) {
      const { id: _id, status: _status, published_at: _publishedAt, ...rest } = published[0];
      void _id;
      void _status;
      void _publishedAt;
      const [created] = await sql<T[]>`
        insert into ${sql(table)} ${sql(wrapJsonFields(sql, { ...rest, status: "draft" }, jsonFields))}
        returning *
      `;
      return created;
    }

    const [created] = await sql<T[]>`
      insert into ${sql(table)} (status) values ('draft') returning *
    `;
    return created;
  });
}

export async function updateDraftSingleton(
  ctx: TenantContext,
  table: string,
  patch: Record<string, unknown>,
  jsonFields: string[] = []
): Promise<void> {
  await withTenantContext(ctx, async (sql) => {
    const finalPatch = wrapJsonFields(
      sql,
      { ...patch, updated_at: new Date().toISOString(), updated_by: ctx.userId },
      jsonFields
    );
    await sql`
      update ${sql(table)}
      set ${sql(finalPatch)}, version = version + 1
      where status = 'draft'
    `;
  });
}

/**
 * Publish = atomically overwrite the published row's content with the
 * draft's, inside one transaction. The published row's id/status never
 * change, so anything referencing it by id stays valid; the draft row
 * is left in place (untouched) so editing can continue immediately.
 */
export async function publishSingleton(
  ctx: TenantContext,
  table: string,
  entityType: string,
  jsonFields: string[] = []
): Promise<void> {
  await withTenantContext(ctx, async (sql) => {
    const [draft] = await sql<Record<string, unknown>[]>`
      select * from ${sql(table)} where status = 'draft' limit 1
    `;
    if (!draft) throw new Error(`No draft row to publish for ${table}`);

    const {
      id: _id,
      status: _status,
      created_at: _createdAt,
      created_by: _createdBy,
      published_at: _publishedAt,
      version: draftVersion,
      ...content
    } = draft;
    void _id;
    void _status;
    void _createdAt;
    void _createdBy;
    void _publishedAt;

    const [existingPublished] = await sql<{ id: string }[]>`
      select id from ${sql(table)} where status = 'published' limit 1
    `;

    if (existingPublished) {
      await sql`
        update ${sql(table)}
        set ${sql(
          wrapJsonFields(
            sql,
            {
              ...content,
              updated_at: new Date().toISOString(),
              updated_by: ctx.userId,
              published_at: new Date().toISOString(),
            },
            jsonFields
          )
        )}
        where id = ${existingPublished.id}
      `;
      await logRevision(sql, entityType, existingPublished.id, draft, Number(draftVersion ?? 1), ctx.userId);
      await logPublish(sql, entityType, existingPublished.id, ctx.userId);
    } else {
      const [created] = await sql<{ id: string }[]>`
        insert into ${sql(table)} ${sql(
          wrapJsonFields(
            sql,
            {
              ...content,
              status: "published",
              published_at: new Date().toISOString(),
              created_by: ctx.userId,
              updated_by: ctx.userId,
            },
            jsonFields
          )
        )}
        returning id
      `;
      await logRevision(sql, entityType, created.id, draft, Number(draftVersion ?? 1), ctx.userId);
      await logPublish(sql, entityType, created.id, ctx.userId);
    }
  });
}

export async function listPublished<T extends Record<string, unknown>>(
  table: string,
  orderBy = "display_order"
): Promise<T[]> {
  return withSystemContext(
    (sql) => sql<T[]>`select * from ${sql(table)} where status = 'published' order by ${sql(orderBy)} asc`
  );
}

export async function listDrafts<T extends Record<string, unknown>>(
  ctx: TenantContext,
  table: string,
  orderBy = "display_order"
): Promise<T[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<T[]>`select * from ${sql(table)} where status = 'draft' order by ${sql(orderBy)} asc`
  );
}

export async function logRevision(
  sql: postgres.TransactionSql,
  entityType: string,
  entityId: string,
  snapshot: unknown,
  version: number,
  editedBy: string
) {
  await sql`
    insert into content_revisions (entity_type, entity_id, snapshot, version, edited_by)
    values (${entityType}, ${entityId}, ${sql.json(snapshot as unknown as postgres.JSONValue)}, ${version}, ${editedBy})
  `;
}

export async function logPublish(
  sql: postgres.TransactionSql,
  entityType: string,
  entityId: string | null,
  publishedBy: string,
  note?: string
) {
  await sql`
    insert into publish_history (entity_type, entity_id, published_by, note)
    values (${entityType}, ${entityId}, ${publishedBy}, ${note ?? null})
  `;
}

export { wrapJsonFields };

export function emptyLocalized(): LocalizedText {
  return { kk: "", ru: "", en: "" };
}
