import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import { jsonbObjectSql, readJsonb } from "@/db/jsonb";
import { toServedMediaUrl } from "@/lib/storage/media-access";

// Every read below is filtered by `r.child_id = ctx.userId`: RLS only
// scopes recognitions to the school, and a child's research journal is
// private — another child's recognition id simply returns nothing.

export type JournalEntry = {
  id: string;
  kind: "PLANT" | "ANIMAL" | "LEAF" | "OBJECT";
  imageUrl: string;
  confidence: number;
  label: string | null;
  funFact: string | null;
  isPotentiallyToxic: boolean;
  provider: string;
  isMock: boolean;
  createdAt: string;
};

type RecognitionRow = {
  id: string;
  kind: JournalEntry["kind"];
  image_url: string;
  confidence: number | string;
  ai_provider: string;
  ai_is_mock: boolean;
  /** Object, or a double-encoded JSON string for rows saved before the sql.json fix. */
  ai_summary: unknown;
  species_label: string | null;
  created_at: string;
};

function toEntry(r: RecognitionRow): JournalEntry {
  const summary = readJsonb<{ label?: string; funFact?: string; isPotentiallyToxic?: boolean }>(r.ai_summary) ?? {};
  return {
    id: r.id,
    kind: r.kind,
    // Legacy public R2 URLs → guarded /uploads/… path (no data rewrite).
    imageUrl: toServedMediaUrl(r.image_url, process.env.R2_PUBLIC_URL) ?? r.image_url,
    confidence: Number(r.confidence),
    label: summary.label ?? r.species_label,
    funFact: summary.funFact ?? null,
    isPotentiallyToxic: Boolean(summary.isPotentiallyToxic),
    provider: r.ai_provider,
    isMock: r.ai_is_mock,
    createdAt: r.created_at,
  };
}

export async function getJournal(ctx: TenantContext, limit = 20): Promise<JournalEntry[]> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<RecognitionRow[]>`
      select
        r.id, r.kind, r.image_url, r.confidence, r.ai_provider, r.ai_is_mock, r.ai_summary,
        (s.common_name->>'kk') as species_label,
        r.created_at
      from recognitions r
      left join species s on s.id = r.species_id
      where r.child_id = ${ctx.userId}
      order by r.created_at desc
      limit ${limit}
    `
  );
  return rows.map(toEntry);
}

export type RecognitionDetail = {
  entry: JournalEntry;
  /** The child's other recognitions of the same object (same label), newest first. */
  history: JournalEntry[];
  /** How many times the child has studied this object, including this one. */
  timesStudied: number;
};

export async function getRecognitionForChild(
  ctx: TenantContext,
  recognitionId: string
): Promise<RecognitionDetail | null> {
  return withTenantContext(ctx, async (sql) => {
    const [row] = await sql<RecognitionRow[]>`
      select r.id, r.kind, r.image_url, r.confidence, r.ai_provider, r.ai_is_mock, r.ai_summary,
             (s.common_name->>'kk') as species_label, r.created_at
      from recognitions r
      left join species s on s.id = r.species_id
      where r.id = ${recognitionId} and r.child_id = ${ctx.userId}
    `;
    if (!row) return null;
    const entry = toEntry(row);

    const history = entry.label
      ? (
          await sql<RecognitionRow[]>`
            select r.id, r.kind, r.image_url, r.confidence, r.ai_provider, r.ai_is_mock, r.ai_summary,
                   (s.common_name->>'kk') as species_label, r.created_at
            from recognitions r
            left join species s on s.id = r.species_id
            where r.child_id = ${ctx.userId}
              and r.id <> ${recognitionId}
              and lower(coalesce(${sql.unsafe(jsonbObjectSql("r.ai_summary"))}->>'label', s.common_name->>'kk', '')) = lower(${entry.label})
            order by r.created_at desc
            limit 20
          `
        ).map(toEntry)
      : [];

    return { entry, history, timesStudied: history.length + 1 };
  });
}

export async function saveRecognition(
  ctx: TenantContext,
  entry: {
    kind: JournalEntry["kind"];
    imageUrl: string;
    confidence: number;
    label: string;
    funFact: string;
    isPotentiallyToxic: boolean;
    provider: string;
    isMock: boolean;
  }
): Promise<{ id: string }> {
  const [row] = await withTenantContext(ctx, (sql) =>
    sql<{ id: string }[]>`
      insert into recognitions (child_id, kind, image_url, confidence, ai_provider, ai_is_mock, ai_summary)
      values (
        ${ctx.userId}, ${entry.kind}, ${entry.imageUrl}, ${entry.confidence},
        ${entry.provider}, ${entry.isMock},
        ${sql.json({ label: entry.label, funFact: entry.funFact, isPotentiallyToxic: entry.isPotentiallyToxic })}
      )
      returning id
    `
  );
  return row;
}
