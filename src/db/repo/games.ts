import "server-only";
import type postgres from "postgres";
import { withTenantContext, type TenantContext } from "@/db/client";
import type { GameResult, GameTemplate, Localized } from "@/lib/domain/game-templates/types";
import type { WasteSortingResult } from "@/lib/domain/waste-sorting";
import { applyXpGain, awardableGameXp, type LevelUpResult } from "@/lib/domain/xp";

export type GameRow = {
  id: string;
  key: string;
  title: Localized;
  description: Localized;
  config: unknown;
  icon: string;
  color: string;
  difficulty: "easy" | "medium" | "hard";
  ageMin: number;
  ageMax: number;
  xpReward: number;
  badgeKey: string | null;
  template: GameTemplate;
  displayOrder: number;
};

/** For CHILD sessions, filters to games matching the child's group's age
 * category — mirroring research.ts's listProjectsForChild live subquery
 * pattern (not a session/JWT field) so a mid-session group reassignment
 * is picked up immediately. A game with an empty age_categories array
 * ("барлық санат") always shows, and a child with no group assigned
 * falls back to the full unfiltered catalog rather than erroring or
 * showing nothing — see the approved groups-module plan §7/§11. */
export async function listGames(ctx: TenantContext): Promise<GameRow[]> {
  return withTenantContext(ctx, async (sql) => {
    if (ctx.role !== "CHILD") {
      return sql<GameRow[]>`
        select id, key, title, description, config, icon, color, difficulty,
               age_min as "ageMin", age_max as "ageMax", xp_reward as "xpReward",
               badge_key as "badgeKey", template, display_order as "displayOrder"
        from games
        order by display_order asc
      `;
    }
    return sql<GameRow[]>`
      select id, key, title, description, config, icon, color, difficulty,
             age_min as "ageMin", age_max as "ageMax", xp_reward as "xpReward",
             badge_key as "badgeKey", template, display_order as "displayOrder"
      from games
      where age_categories = '{}'
         or (select g.age_category from groups g join users u on u.group_id = g.id where u.id = ${ctx.userId})
            = any(age_categories)
      order by display_order asc
    `;
  });
}

export async function getGameByKey(ctx: TenantContext, key: string): Promise<GameRow | null> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<GameRow[]>`
      select id, key, title, description, config, icon, color, difficulty,
             age_min as "ageMin", age_max as "ageMax", xp_reward as "xpReward",
             badge_key as "badgeKey", template, display_order as "displayOrder"
      from games
      where key = ${key}
      limit 1
    `
  );
  return rows[0] ?? null;
}

export async function getGameIdByKey(ctx: TenantContext, key: string): Promise<string | null> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<{ id: string }[]>`select id from games where key = ${key}`
  );
  return rows[0]?.id ?? null;
}

/**
 * Saves one finished round and pays its XP in a single transaction.
 * The child's users row is locked first (`for update`), so two rounds
 * submitted at the same moment (double tap, two tabs) are serialised
 * and the second sees the first one's payout — a game's XP can never
 * be counted twice. The payout follows awardableGameXp: a game pays at
 * most `xpCap` in total, a replay only pays the improvement.
 *
 * game_sessions.xp_earned stores what was actually paid for the round
 * (0 for a replay), so family/teacher XP sums stay equal to users.xp.
 */
export async function recordGameRoundWithXp(
  ctx: TenantContext,
  gameId: string,
  result: WasteSortingResult | GameResult,
  xpCap: number
): Promise<{ xpAwarded: number; level: LevelUpResult }> {
  return withTenantContext(ctx, async (sql) => {
    const [user] = await sql<{ xp: number }[]>`select xp from users where id = ${ctx.userId} for update`;
    const [{ paid }] = await sql<{ paid: number }[]>`
      select coalesce(sum(xp_earned), 0)::int as paid
      from game_sessions where child_id = ${ctx.userId} and game_id = ${gameId}
    `;
    const xpAwarded = awardableGameXp(result.xpEarned, paid, xpCap);
    await sql`
      insert into game_sessions (child_id, game_id, started_at, ended_at, score, correct_count, total_count, xp_earned, attempt_data)
      values (
        ${ctx.userId}, ${gameId}, now(), now(),
        ${result.score}, ${result.correctCount}, ${result.totalCount}, ${xpAwarded},
        ${sql.json(result.perItem as unknown as postgres.JSONValue)}
      )
    `;
    const level = applyXpGain(user?.xp ?? 0, xpAwarded);
    if (xpAwarded > 0) {
      await sql`update users set xp = ${level.newXp}, level = ${level.newLevel} where id = ${ctx.userId}`;
    }
    return { xpAwarded, level };
  });
}

export type GameHistoryRow = {
  id: string;
  score: number;
  correctCount: number;
  totalCount: number;
  xpEarned: number;
  endedAt: string;
};

export async function getGameHistory(
  ctx: TenantContext,
  gameKey: string,
  limit = 10
): Promise<GameHistoryRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<GameHistoryRow[]>`
      select gs.id, gs.score, gs.correct_count as "correctCount", gs.total_count as "totalCount",
             gs.xp_earned as "xpEarned", gs.ended_at as "endedAt"
      from game_sessions gs
      join games g on g.id = gs.game_id
      where gs.child_id = ${ctx.userId} and g.key = ${gameKey}
      order by gs.ended_at desc
      limit ${limit}
    `
  );
}

export type GameProgress = {
  gameId: string;
  timesPlayed: number;
  bestScore: number;
  bestCorrectCount: number;
  bestTotalCount: number;
};

/** One row per game the current child has ever played, for the hub
 * grid's progress bars — a single grouped query rather than N. */
export async function getAllGameProgress(ctx: TenantContext): Promise<Record<string, GameProgress>> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<GameProgress[]>`
      select
        game_id as "gameId",
        count(*)::int as "timesPlayed",
        max(score) as "bestScore",
        (array_agg(correct_count order by score desc))[1] as "bestCorrectCount",
        (array_agg(total_count order by score desc))[1] as "bestTotalCount"
      from game_sessions
      where child_id = ${ctx.userId} and ended_at is not null
      group by game_id
    `
  );
  return Object.fromEntries(rows.map((r) => [r.gameId, r]));
}
