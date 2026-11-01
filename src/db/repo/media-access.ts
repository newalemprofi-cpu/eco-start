import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import { decideMediaAccess, type MediaDecision, type PrivateMediaKey } from "@/lib/storage/media-access";

/**
 * Looks up the facts decideMediaAccess needs, *through the viewer's
 * own tenant context* — RLS on `users` already hides a child from
 * another school, so a cross-school viewer gets childSchoolId = null
 * (→ deny) even before the explicit school comparison.
 */
export async function checkChildMediaAccess(ctx: TenantContext | null, file: PrivateMediaKey): Promise<MediaDecision> {
  if (!ctx) return "unauthenticated";

  const [row] = await withTenantContext(
    ctx,
    (sql) => sql<{ childSchoolId: string; linkedParent: boolean; teachesGroup: boolean }[]>`
      select u.school_id as "childSchoolId",
        exists (
          select 1 from parent_child_links l where l.child_id = u.id and l.parent_id = ${ctx.userId}
        ) as "linkedParent",
        exists (
          select 1 from teacher_groups tg where tg.group_id = u.group_id and tg.teacher_id = ${ctx.userId}
        ) as "teachesGroup"
      from users u
      where u.id = ${file.childId} and u.role = 'CHILD'
    `
  );

  return decideMediaAccess(
    { userId: ctx.userId, role: ctx.role, schoolId: ctx.schoolId },
    file,
    {
      childSchoolId: row?.childSchoolId ?? null,
      viewerIsLinkedParent: row?.linkedParent ?? false,
      viewerTeachesChildGroup: row?.teachesGroup ?? false,
    }
  );
}
