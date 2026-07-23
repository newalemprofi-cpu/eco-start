import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import { applyXpGain, type LevelUpResult } from "@/lib/domain/xp";

/** Awards XP to the currently-authenticated child and persists the
 * resulting level. Always reads the current value inside the same
 * transaction as the write, so concurrent awards (e.g. two tabs) don't
 * clobber each other. */
export async function awardXp(ctx: TenantContext, amount: number): Promise<LevelUpResult> {
  return withTenantContext(ctx, async (sql) => {
    const [row] = await sql<{ xp: number }[]>`select xp from users where id = ${ctx.userId} for update`;
    const result = applyXpGain(row?.xp ?? 0, amount);
    await sql`update users set xp = ${result.newXp}, level = ${result.newLevel} where id = ${ctx.userId}`;
    return result;
  });
}
