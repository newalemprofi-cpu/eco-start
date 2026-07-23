import "server-only";
import type postgres from "postgres";
import { withTenantContext, type TenantContext } from "@/db/client";

export async function logAudit(
  ctx: TenantContext,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown
): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`
      insert into audit_logs (school_id, actor_id, action, entity_type, entity_id, before, after)
      values (
        ${ctx.schoolId}, ${ctx.userId}, ${action}, ${entityType}, ${entityId},
        ${before ? sql.json(before as unknown as postgres.JSONValue) : null},
        ${after ? sql.json(after as unknown as postgres.JSONValue) : null}
      )
    `
  );
}

export type AuditLogRow = {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

export async function listAuditLogs(ctx: TenantContext, limit = 50): Promise<AuditLogRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<AuditLogRow[]>`
      select al.id, u.display_name as "actorName", al.action, al.entity_type as "entityType",
             al.entity_id as "entityId", al.created_at as "createdAt"
      from audit_logs al
      left join users u on u.id = al.actor_id
      where al.school_id = ${ctx.schoolId}
      order by al.created_at desc
      limit ${limit}
    `
  );
}
