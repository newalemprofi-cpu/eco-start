import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type LinkedChild = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  groupId: string | null;
};

export async function getLinkedChildren(ctx: TenantContext): Promise<LinkedChild[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<LinkedChild[]>`
      select u.id, u.display_name as "displayName", u.avatar_url as "avatarUrl", u.xp, u.level, u.group_id as "groupId"
      from parent_child_links l
      join users u on u.id = l.child_id
      where l.parent_id = ${ctx.userId}
      order by u.display_name
    `
  );
}

export async function getWeeklyStats(ctx: TenantContext, childId: string) {
  return withTenantContext(ctx, async (sql) => {
    const [xpRow] = await sql<{ xpGained: number }[]>`
      select coalesce(sum(xp_earned), 0)::int as "xpGained"
      from game_sessions where child_id = ${childId} and ended_at > now() - interval '7 days'
    `;
    const [badgeRow] = await sql<{ newBadges: number }[]>`
      select count(*)::int as "newBadges" from child_achievements
      where child_id = ${childId} and earned_at > now() - interval '7 days'
    `;
    const [mediaRow] = await sql<{ mediaCount: number }[]>`
      select count(*)::int as "mediaCount" from media_assets
      where child_id = ${childId} and created_at > now() - interval '7 days'
    `;
    return {
      xpGained: xpRow?.xpGained ?? 0,
      newBadges: badgeRow?.newBadges ?? 0,
      mediaCount: mediaRow?.mediaCount ?? 0,
    };
  });
}

export type HomeworkItem = { id: string; topic: string; dueAt: string | null };

export async function getHomework(ctx: TenantContext, groupId: string | null): Promise<HomeworkItem[]> {
  if (!groupId) return [];
  return withTenantContext(
    ctx,
    (sql) => sql<HomeworkItem[]>`
      select la.id, l.topic, la.due_at as "dueAt"
      from lesson_assignments la
      join lessons l on l.id = la.lesson_id
      where la.group_id = ${groupId}
      order by la.assigned_at desc
      limit 5
    `
  );
}
