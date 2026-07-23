import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

/**
 * Central "can this session see this child's data" check, used by
 * every route/page that renders one specific child's records outside
 * the child's own session (parent portal, certificate downloads,
 * teacher/admin views). CHILD role only ever passes for its own id;
 * PARENT requires an approved link; TEACHER/SCHOOL_ADMIN/SUPER_ADMIN
 * are already school-scoped by RLS, so a same-school check is enough.
 */
export async function canAccessChildData(ctx: TenantContext, childId: string): Promise<boolean> {
  if (ctx.role === "CHILD") return ctx.userId === childId;
  if (ctx.role === "SUPER_ADMIN") return true;

  if (ctx.role === "PARENT") {
    const rows = await withTenantContext(
      ctx,
      (sql) => sql<{ id: string }[]>`
        select id from parent_child_links where parent_id = ${ctx.userId} and child_id = ${childId}
      `
    );
    return rows.length > 0;
  }

  // TEACHER / SCHOOL_ADMIN: same-school is already enforced by RLS on
  // the `users` row lookup itself, so a non-empty result is sufficient.
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<{ id: string }[]>`select id from users where id = ${childId} and role = 'CHILD'`
  );
  return rows.length > 0;
}
