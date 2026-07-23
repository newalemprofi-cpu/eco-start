import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type GroupAnalytics = {
  avgXp: number;
  totalChildren: number;
  activeChildren: number;
  gameSessions: number;
  gameAvgScore: number;
  researchObservations: number;
  xpByChild: { name: string; xp: number }[];
  gamesByDay: { day: string; sessions: number }[];
};

export async function getGroupAnalytics(ctx: TenantContext, groupId: string): Promise<GroupAnalytics> {
  return withTenantContext(ctx, async (sql) => {
    const [summary] = await sql<
      { avgXp: number; totalChildren: number }[]
    >`
      select coalesce(avg(xp), 0)::float as "avgXp", count(*)::int as "totalChildren"
      from users where role = 'CHILD' and group_id = ${groupId}
    `;

    const [active] = await sql<{ activeChildren: number }[]>`
      select count(distinct child_id)::int as "activeChildren" from (
        (select child_id from game_sessions gs join users u on u.id = gs.child_id
         where u.group_id = ${groupId} and gs.started_at > now() - interval '7 days')
        union
        (select child_id from recognitions r join users u on u.id = r.child_id
         where u.group_id = ${groupId} and r.created_at > now() - interval '7 days')
      ) x
    `;

    const [games] = await sql<{ gameSessions: number; gameAvgScore: number }[]>`
      select count(*)::int as "gameSessions", coalesce(avg(gs.score), 0)::float as "gameAvgScore"
      from game_sessions gs join users u on u.id = gs.child_id
      where u.group_id = ${groupId}
    `;

    const [research] = await sql<{ researchObservations: number }[]>`
      select count(*)::int as "researchObservations"
      from research_observations ro join users u on u.id = ro.child_id
      where u.group_id = ${groupId}
    `;

    const xpByChild = await sql<{ name: string; xp: number }[]>`
      select display_name as name, xp from users where role = 'CHILD' and group_id = ${groupId} order by xp desc
    `;

    const gamesByDay = await sql<{ day: string; sessions: number }[]>`
      select to_char(gs.ended_at, 'MM-DD') as day, count(*)::int as sessions
      from game_sessions gs join users u on u.id = gs.child_id
      where u.group_id = ${groupId} and gs.ended_at is not null
      group by day order by day
    `;

    return {
      avgXp: Math.round(summary?.avgXp ?? 0),
      totalChildren: summary?.totalChildren ?? 0,
      activeChildren: active?.activeChildren ?? 0,
      gameSessions: games?.gameSessions ?? 0,
      gameAvgScore: Math.round(games?.gameAvgScore ?? 0),
      researchObservations: research?.researchObservations ?? 0,
      xpByChild,
      gamesByDay,
    };
  });
}
