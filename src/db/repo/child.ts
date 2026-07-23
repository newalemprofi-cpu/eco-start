import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type ChildSummary = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
};

export async function getChildSummary(ctx: TenantContext): Promise<ChildSummary> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<ChildSummary[]>`
      select id, display_name as "displayName", avatar_url as "avatarUrl", xp, level
      from users where id = ${ctx.userId}
    `
  );
  return rows[0];
}

export type EarnedBadge = {
  id: string;
  key: string;
  title: Record<string, string>;
  icon: string;
  earnedAt: string;
};

export async function getRecentBadges(ctx: TenantContext, limit = 5): Promise<EarnedBadge[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<EarnedBadge[]>`
      select a.id, a.key, a.title, a.icon, ca.earned_at as "earnedAt"
      from child_achievements ca
      join achievements a on a.id = ca.achievement_id
      where ca.child_id = ${ctx.userId}
      order by ca.earned_at desc
      limit ${limit}
    `
  );
}

export async function getAllChildrenInGroup(ctx: TenantContext, groupId: string) {
  return withTenantContext(
    ctx,
    (sql) => sql<{ id: string; displayName: string; xp: number; level: number; avatarUrl: string | null }[]>`
      select id, display_name as "displayName", xp, level, avatar_url as "avatarUrl"
      from users
      where role = 'CHILD' and group_id = ${groupId}
      order by display_name
    `
  );
}
