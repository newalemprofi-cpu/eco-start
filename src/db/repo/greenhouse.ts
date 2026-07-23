import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type GreenhouseEntry = {
  id: string;
  nickname: string;
  plantedAt: string;
  waterSchedule: string;
  lastWateredAt: string | null;
  status: "active" | "harvested" | "archived";
  latestHeightCm: number | null;
};

export async function listEntries(ctx: TenantContext): Promise<GreenhouseEntry[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<GreenhouseEntry[]>`
      select
        e.id, e.nickname, e.planted_at as "plantedAt", e.water_schedule as "waterSchedule",
        e.last_watered_at as "lastWateredAt", e.status,
        (select g.height_cm from growth_logs g where g.entry_id = e.id order by g.logged_at desc limit 1) as "latestHeightCm"
      from greenhouse_entries e
      where e.child_id = ${ctx.userId}
      order by e.planted_at desc
    `
  );
}

export async function getEntry(ctx: TenantContext, entryId: string) {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<GreenhouseEntry[]>`
      select
        e.id, e.nickname, e.planted_at as "plantedAt", e.water_schedule as "waterSchedule",
        e.last_watered_at as "lastWateredAt", e.status,
        null as "latestHeightCm"
      from greenhouse_entries e
      where e.id = ${entryId} and e.child_id = ${ctx.userId}
    `
  );
  return rows[0] ?? null;
}

export type GrowthLog = { id: string; loggedAt: string; heightCm: number | null; note: string | null };

export async function getGrowthLogs(ctx: TenantContext, entryId: string): Promise<GrowthLog[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<GrowthLog[]>`
      select g.id, g.logged_at as "loggedAt", g.height_cm as "heightCm", g.note
      from growth_logs g
      join greenhouse_entries e on e.id = g.entry_id
      where g.entry_id = ${entryId} and e.child_id = ${ctx.userId}
      order by g.logged_at asc
    `
  );
}

export async function createEntry(
  ctx: TenantContext,
  input: { nickname: string; waterSchedule: string }
): Promise<{ id: string }> {
  const [row] = await withTenantContext(
    ctx,
    (sql) => sql<{ id: string }[]>`
      insert into greenhouse_entries (child_id, nickname, water_schedule)
      values (${ctx.userId}, ${input.nickname}, ${input.waterSchedule})
      returning id
    `
  );
  return row;
}

export async function addGrowthLog(
  ctx: TenantContext,
  entryId: string,
  input: { heightCm: number | null; note: string | null }
): Promise<void> {
  await withTenantContext(ctx, async (sql) => {
    const [owned] = await sql<{ id: string }[]>`
      select id from greenhouse_entries where id = ${entryId} and child_id = ${ctx.userId}
    `;
    if (!owned) throw new Error("Not found");
    await sql`
      insert into growth_logs (entry_id, height_cm, note)
      values (${entryId}, ${input.heightCm}, ${input.note})
    `;
  });
}

export async function markWatered(ctx: TenantContext, entryId: string): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`
      update greenhouse_entries set last_watered_at = current_date
      where id = ${entryId} and child_id = ${ctx.userId}
    `
  );
}
