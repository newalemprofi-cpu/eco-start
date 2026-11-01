import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import type { SessionUserState } from "@/lib/auth/session-validity";

/** The signed-in user's own row, read through RLS (`users` lets a user
 * see itself via app_current_user_id()). Called once per request by
 * dal.ts (React cache) — a single indexed primary-key lookup. */
export async function getSessionUserState(ctx: TenantContext): Promise<SessionUserState | null> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<SessionUserState[]>`
      select role, school_id as "schoolId", archived_at as "archivedAt",
             extract(epoch from sessions_revoked_at)::float8 as "sessionsRevokedAt"
      from users where id = ${ctx.userId}
    `
  );
  return rows[0] ?? null;
}
