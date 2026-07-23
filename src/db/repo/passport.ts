import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type Certificate = {
  id: string;
  title: Record<string, string>;
  reason: string;
  issuedAt: string;
};

export async function getCertificates(ctx: TenantContext, childId?: string): Promise<Certificate[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<Certificate[]>`
      select id, title, reason, issued_at as "issuedAt"
      from certificates
      where child_id = ${childId ?? ctx.userId}
      order by issued_at desc
    `
  );
}

export async function getCertificate(ctx: TenantContext, certificateId: string) {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<
      (Certificate & { childId: string; childName: string; schoolName: string })[]
    >`
      select c.id, c.title, c.reason, c.issued_at as "issuedAt",
             c.child_id as "childId", u.display_name as "childName", s.name as "schoolName"
      from certificates c
      join users u on u.id = c.child_id
      join schools s on s.id = c.school_id
      where c.id = ${certificateId}
    `
  );
  return rows[0] ?? null;
}

export type AllBadges = {
  id: string;
  key: string;
  title: Record<string, string>;
  description: Record<string, string>;
  icon: string;
  xpReward: number;
  earnedAt: string | null;
};

export async function getAllBadgesWithStatus(ctx: TenantContext, childId?: string): Promise<AllBadges[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<AllBadges[]>`
      select a.id, a.key, a.title, a.description, a.icon, a.xp_reward as "xpReward",
             ca.earned_at as "earnedAt"
      from achievements a
      left join child_achievements ca on ca.achievement_id = a.id and ca.child_id = ${childId ?? ctx.userId}
      order by (ca.earned_at is null), ca.earned_at desc
    `
  );
}

export type ActivityItem = {
  kind: "recognition" | "game" | "growth" | "research";
  label: string;
  occurredAt: string;
};

export async function getRecentActivities(ctx: TenantContext, childId?: string, limit = 8): Promise<ActivityItem[]> {
  const cid = childId ?? ctx.userId;
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<ActivityItem[]>`
      (select 'recognition' as kind, coalesce(ai_summary->>'label', 'Эко Зертхана') as label, created_at as "occurredAt"
       from recognitions where child_id = ${cid})
      union all
      (select 'game' as kind, ('Ойын: ' || score || ' ұпай') as label, ended_at as "occurredAt"
       from game_sessions where child_id = ${cid} and ended_at is not null)
      union all
      (select 'growth' as kind, ('Жасыл бөбекжай: ' || coalesce(height_cm::text, '?') || ' см') as label, g.created_at as "occurredAt"
       from growth_logs g join greenhouse_entries e on e.id = g.entry_id where e.child_id = ${cid})
      union all
      (select 'research' as kind, ('Зерттеу: ' || coalesce(measurement::text, '?')) as label, created_at as "occurredAt"
       from research_observations where child_id = ${cid})
      order by "occurredAt" desc
      limit ${limit}
    `;
    return rows;
  });
}
