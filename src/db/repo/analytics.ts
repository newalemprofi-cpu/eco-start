import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import { jsonbObjectSql } from "@/db/jsonb";

// Every function here takes a groupId the caller has already checked
// against teacher_groups (see teacherOwnsGroup) — RLS alone only scopes
// to the school, and a teacher must only see their own group's children.

/** Days of history behind the "activity dynamics" bars. */
export const ACTIVITY_WINDOW_DAYS = 14;
/** "Active" = did anything in this many days. */
export const ACTIVE_WINDOW_DAYS = 7;

type Tx = Parameters<Parameters<typeof withTenantContext>[1]>[0];

/** One row per child action across every module, used by the
 * activity counts below so they all agree on what "activity" means
 * (the old activeChildren metric only counted games + EcoLab). */
const ACTIVITY_EVENTS = (sql: Tx, groupId: string) => sql`
  select gs.child_id, coalesce(gs.ended_at, gs.started_at) as at, 'game' as kind
    from game_sessions gs join users u on u.id = gs.child_id where u.group_id = ${groupId}
  union all
  select r.child_id, r.created_at, 'ecolab'
    from recognitions r join users u on u.id = r.child_id where u.group_id = ${groupId}
  union all
  select e.child_id, gl.created_at, 'greenhouse'
    from growth_logs gl join greenhouse_entries e on e.id = gl.entry_id join users u on u.id = e.child_id
    where u.group_id = ${groupId}
  union all
  select o.child_id, o.created_at, 'research'
    from research_observations o join users u on u.id = o.child_id where u.group_id = ${groupId}
`;

export async function teacherOwnsGroup(ctx: TenantContext, groupId: string): Promise<boolean> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<{ ok: number }[]>`
      select 1 as ok from teacher_groups where teacher_id = ${ctx.userId} and group_id = ${groupId}
    `
  );
  return rows.length > 0;
}

export type GroupAnalytics = {
  avgXp: number;
  totalChildren: number;
  activeChildren: number;
  gameSessions: number;
  gameAvgScore: number;
  researchObservations: number;
  xpByChild: { name: string; xp: number }[];
  activityByDay: { day: string; actions: number }[];
};

export async function getGroupAnalytics(ctx: TenantContext, groupId: string): Promise<GroupAnalytics> {
  return withTenantContext(ctx, async (sql) => {
    const [summary] = await sql<{ avgXp: number; totalChildren: number }[]>`
      select coalesce(avg(xp), 0)::float as "avgXp", count(*)::int as "totalChildren"
      from users where role = 'CHILD' and group_id = ${groupId}
    `;

    const [active] = await sql<{ activeChildren: number }[]>`
      select count(distinct child_id)::int as "activeChildren"
      from (${ACTIVITY_EVENTS(sql, groupId)}) ev
      where ev.at > now() - make_interval(days => ${ACTIVE_WINDOW_DAYS})
    `;

    const [games] = await sql<{ gameSessions: number; gameAvgScore: number }[]>`
      select count(*)::int as "gameSessions", coalesce(avg(gs.score), 0)::float as "gameAvgScore"
      from game_sessions gs join users u on u.id = gs.child_id
      where u.group_id = ${groupId} and gs.ended_at is not null
    `;

    const [research] = await sql<{ researchObservations: number }[]>`
      select count(*)::int as "researchObservations"
      from research_observations ro join users u on u.id = ro.child_id
      where u.group_id = ${groupId}
    `;

    const xpByChild = await sql<{ name: string; xp: number }[]>`
      select display_name as name, xp from users where role = 'CHILD' and group_id = ${groupId} order by xp desc
    `;

    const activityByDay = await sql<{ day: string; actions: number }[]>`
      select to_char(d.day, 'MM-DD') as day, count(ev.child_id)::int as actions
      from generate_series(current_date - ${ACTIVITY_WINDOW_DAYS - 1}::int, current_date, interval '1 day') as d(day)
      left join (${ACTIVITY_EVENTS(sql, groupId)}) ev on ev.at::date = d.day::date
      group by d.day order by d.day
    `;

    return {
      avgXp: Math.round(summary?.avgXp ?? 0),
      totalChildren: summary?.totalChildren ?? 0,
      activeChildren: active?.activeChildren ?? 0,
      gameSessions: games?.gameSessions ?? 0,
      gameAvgScore: Math.round(games?.gameAvgScore ?? 0),
      researchObservations: research?.researchObservations ?? 0,
      xpByChild,
      activityByDay,
    };
  });
}

export type ChildActivityRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  gamesPlayed: number;
  distinctGames: number;
  researchObservations: number;
  recognitions: number;
  growthLogs: number;
  achievements: number;
  lastActivityAt: string | null;
  isActive: boolean;
  /** Actions per day, oldest first, ACTIVITY_WINDOW_DAYS long. */
  daily: number[];
};

export async function getChildActivityTable(ctx: TenantContext, groupId: string): Promise<ChildActivityRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ChildActivityRow[]>`
      with ev as (${ACTIVITY_EVENTS(sql, groupId)})
      select u.id, u.display_name as "displayName", u.avatar_url as "avatarUrl", u.xp, u.level,
        (select count(*)::int from game_sessions gs where gs.child_id = u.id and gs.ended_at is not null) as "gamesPlayed",
        (select count(distinct gs.game_id)::int from game_sessions gs where gs.child_id = u.id and gs.ended_at is not null) as "distinctGames",
        (select count(*)::int from research_observations o where o.child_id = u.id) as "researchObservations",
        (select count(*)::int from recognitions r where r.child_id = u.id) as recognitions,
        (select count(*)::int from growth_logs gl join greenhouse_entries e on e.id = gl.entry_id where e.child_id = u.id) as "growthLogs",
        (select count(*)::int from child_achievements ca where ca.child_id = u.id) as achievements,
        (select max(ev.at) from ev where ev.child_id = u.id) as "lastActivityAt",
        exists (select 1 from ev where ev.child_id = u.id and ev.at > now() - make_interval(days => ${ACTIVE_WINDOW_DAYS})) as "isActive",
        (select array_agg(coalesce(c.n, 0) order by d.day)::int[]
           from generate_series(current_date - ${ACTIVITY_WINDOW_DAYS - 1}::int, current_date, interval '1 day') as d(day)
           left join (select ev.at::date as day, count(*) as n from ev where ev.child_id = u.id group by 1) c
             on c.day = d.day::date) as daily
      from users u
      where u.role = 'CHILD' and u.group_id = ${groupId}
      order by "isActive" desc, "lastActivityAt" desc nulls last, u.display_name
    `
  );
}

export type GameBreakdownRow = { gameId: string; title: Record<string, string>; sessions: number; children: number; avgScore: number };

export async function getGameBreakdown(ctx: TenantContext, groupId: string): Promise<GameBreakdownRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<GameBreakdownRow[]>`
      select g.id as "gameId", g.title, count(*)::int as sessions, count(distinct gs.child_id)::int as children,
             round(avg(gs.score))::int as "avgScore"
      from game_sessions gs
      join users u on u.id = gs.child_id
      join games g on g.id = gs.game_id
      where u.group_id = ${groupId} and gs.ended_at is not null
      group by g.id, g.title
      order by sessions desc
    `
  );
}

export type ResearchBreakdownRow = {
  projectId: string;
  title: string;
  status: string;
  observations: number;
  participants: number;
  lastObservationAt: string | null;
};

export async function getResearchBreakdown(ctx: TenantContext, groupId: string): Promise<ResearchBreakdownRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ResearchBreakdownRow[]>`
      select p.id as "projectId", p.title, p.status,
             count(o.id)::int as observations, count(distinct o.child_id)::int as participants,
             max(o.created_at) as "lastObservationAt"
      from research_projects p
      left join research_observations o on o.project_id = p.id
      where p.group_id = ${groupId}
      group by p.id
      order by p.started_at desc
    `
  );
}

export type ChildDetail = {
  child: ChildActivityRow;
  games: { title: Record<string, string>; score: number; xpEarned: number; endedAt: string }[];
  research: { projectTitle: string; measurement: number | null; note: string | null; loggedAt: string }[];
  achievements: { title: Record<string, string>; earnedAt: string }[];
  recognitions: { label: string | null; kind: string; createdAt: string }[];
};

/** The group a child belongs to, if it is one of the teacher's groups. */
export async function getTeacherChildGroup(ctx: TenantContext, childId: string): Promise<string | null> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<{ groupId: string }[]>`
      select u.group_id as "groupId"
      from users u
      join teacher_groups tg on tg.group_id = u.group_id and tg.teacher_id = ${ctx.userId}
      where u.id = ${childId} and u.role = 'CHILD'
    `
  );
  return rows[0]?.groupId ?? null;
}

/** Full view of one child, only when that child is in `groupId`. */
export async function getChildDetail(ctx: TenantContext, groupId: string, childId: string): Promise<ChildDetail | null> {
  const table = await getChildActivityTable(ctx, groupId);
  const child = table.find((c) => c.id === childId);
  if (!child) return null;

  return withTenantContext(ctx, async (sql) => {
    const games = await sql<ChildDetail["games"]>`
      select g.title, gs.score, gs.xp_earned as "xpEarned", gs.ended_at as "endedAt"
      from game_sessions gs join games g on g.id = gs.game_id
      where gs.child_id = ${childId} and gs.ended_at is not null
      order by gs.ended_at desc limit 20
    `;
    const research = await sql<ChildDetail["research"]>`
      select p.title as "projectTitle", o.measurement, o.note, o.logged_at as "loggedAt"
      from research_observations o join research_projects p on p.id = o.project_id
      where o.child_id = ${childId}
      order by o.created_at desc limit 20
    `;
    const achievements = await sql<ChildDetail["achievements"]>`
      select a.title, ca.earned_at as "earnedAt"
      from child_achievements ca join achievements a on a.id = ca.achievement_id
      where ca.child_id = ${childId}
      order by ca.earned_at desc
    `;
    const recognitions = await sql<ChildDetail["recognitions"]>`
      select ${sql.unsafe(jsonbObjectSql("r.ai_summary"))}->>'label' as label, r.kind, r.created_at as "createdAt"
      from recognitions r where r.child_id = ${childId}
      order by r.created_at desc limit 10
    `;
    return { child, games, research, achievements, recognitions };
  });
}
