import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

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

export async function getJournal(ctx: TenantContext, limit = 20): Promise<JournalEntry[]> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<
      {
        id: string;
        kind: JournalEntry["kind"];
        image_url: string;
        confidence: string;
        ai_provider: string;
        ai_is_mock: boolean;
        ai_summary: { label?: string; funFact?: string; isPotentiallyToxic?: boolean };
        species_label: string | null;
        created_at: string;
      }[]
    >`
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

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    imageUrl: r.image_url,
    confidence: Number(r.confidence),
    label: r.ai_summary?.label ?? r.species_label,
    funFact: r.ai_summary?.funFact ?? null,
    isPotentiallyToxic: Boolean(r.ai_summary?.isPotentiallyToxic),
    provider: r.ai_provider,
    isMock: r.ai_is_mock,
    createdAt: r.created_at,
  }));
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
): Promise<void> {
  await withTenantContext(ctx, (sql) =>
    sql`
      insert into recognitions (child_id, kind, image_url, confidence, ai_provider, ai_is_mock, ai_summary)
      values (
        ${ctx.userId}, ${entry.kind}, ${entry.imageUrl}, ${entry.confidence},
        ${entry.provider}, ${entry.isMock},
        ${JSON.stringify({ label: entry.label, funFact: entry.funFact, isPotentiallyToxic: entry.isPotentiallyToxic })}
      )
    `
  );
}
