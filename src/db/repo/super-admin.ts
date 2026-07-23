import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type SchoolRow = {
  id: string;
  name: string;
  region: string | null;
  plan: string;
  teacherCount: number;
  childCount: number;
  needsReviewCount: number;
};

export async function listSchools(ctx: TenantContext): Promise<SchoolRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<SchoolRow[]>`
      select s.id, s.name, s.region, s.plan,
             (select count(*)::int from users u where u.school_id = s.id and u.role = 'TEACHER') as "teacherCount",
             (select count(*)::int from users u where u.school_id = s.id and u.role = 'CHILD') as "childCount",
             (select count(*)::int from users u where u.school_id = s.id and u.role = 'CHILD' and u.needs_review) as "needsReviewCount"
      from schools s
      order by s.created_at desc
    `
  );
}

export type PlatformAiUsage = { provider: string; calls: number; mockCalls: number };

export async function getAiUsageByProvider(ctx: TenantContext): Promise<PlatformAiUsage[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<PlatformAiUsage[]>`
      select provider,
             count(*)::int as calls,
             count(*) filter (where is_mock)::int as "mockCalls"
      from ai_logs
      group by provider
      order by calls desc
    `
  );
}

export async function listAllAuditLogs(ctx: TenantContext, limit = 100) {
  return withTenantContext(
    ctx,
    (sql) => sql<
      { id: string; schoolName: string | null; actorName: string | null; action: string; entityType: string; createdAt: string }[]
    >`
      select al.id, s.name as "schoolName", u.display_name as "actorName", al.action, al.entity_type as "entityType",
             al.created_at as "createdAt"
      from audit_logs al
      left join schools s on s.id = al.school_id
      left join users u on u.id = al.actor_id
      order by al.created_at desc
      limit ${limit}
    `
  );
}
