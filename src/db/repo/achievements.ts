import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

/**
 * Achievements/child_achievements existed as a display-only system
 * before this — everything in it was seed data, and nothing in the
 * running app ever inserted a row (see docs/PROJECT_BLUEPRINT.md and
 * scripts/seed.ts, the only prior writer). This is the first real
 * runtime awarder, used by the EcoGame templates: a game with a
 * `badge_key` calls this after a strong-enough round.
 */
export async function awardBadgeIfNotEarned(ctx: TenantContext, achievementKey: string): Promise<boolean> {
  return withTenantContext(ctx, async (sql) => {
    const [achievement] = await sql<{ id: string }[]>`select id from achievements where key = ${achievementKey}`;
    if (!achievement) return false;

    const inserted = await sql<{ id: string }[]>`
      insert into child_achievements (child_id, achievement_id)
      values (${ctx.userId}, ${achievement.id})
      on conflict (child_id, achievement_id) do nothing
      returning id
    `;
    return inserted.length > 0;
  });
}
