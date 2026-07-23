import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

// Groups (kindergarten classes) — plain operational CRUD, not the CMS
// draft/publish pattern (cms.ts, news.ts): a group is edited in place,
// there is no "unpublished draft" concept for a real class roster.
// RLS's existing `groups` tenant_isolation policy (0002_rls.sql) already
// covers every command (FOR ALL, no explicit list), so no RLS changes
// were needed for this module — only new columns (0011 migration).

export { GROUP_AGE_CATEGORIES, type GroupAgeCategory } from "@/lib/group-age-categories";
import type { GroupAgeCategory } from "@/lib/group-age-categories";

export type GroupRow = {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  ageCategory: GroupAgeCategory;
  educatorId: string | null;
  educatorName: string | null;
  pedagogicalAssistantId: string | null;
  pedagogicalAssistantName: string | null;
  childCount: number;
  linkedChildCount: number;
  description: string;
  academicYear: string;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Shared by listGroups/getGroup/create/update — always run inside the
 * same transaction `sql` (from withTenantContext), never a bare pool
 * query, so RLS stays scoped. */
function selectGroups(sql: Parameters<Parameters<typeof withTenantContext>[1]>[0], where = sql``) {
  return sql<GroupRow[]>`
    select g.id, g.school_id as "schoolId", g.name, g.code, g.age_category as "ageCategory",
           g.educator_id as "educatorId", eu.display_name as "educatorName",
           g.pedagogical_assistant_id as "pedagogicalAssistantId", au.display_name as "pedagogicalAssistantName",
           g.child_count as "childCount",
           (select count(*)::int from users c where c.group_id = g.id and c.role = 'CHILD') as "linkedChildCount",
           g.description, g.academic_year as "academicYear", g.is_active as "isActive",
           g.archived_at as "archivedAt", g.created_at as "createdAt", g.updated_at as "updatedAt"
    from groups g
    left join users eu on eu.id = g.educator_id
    left join users au on au.id = g.pedagogical_assistant_id
    ${where}
    order by g.archived_at nulls first, g.name
  `;
}

// Search/age-category/educator/status filtering happens client-side in
// groups-manager.tsx over the full list — this school's group count is
// small (dozens at most), and every other admin list editor in this
// codebase (news-editor.tsx, banners-editor.tsx) follows the same
// "list everything, filter in the component" shape rather than dynamic
// server-side WHERE clauses.
export async function listGroups(ctx: TenantContext): Promise<GroupRow[]> {
  return withTenantContext(ctx, (sql) => selectGroups(sql));
}

export async function getGroup(ctx: TenantContext, id: string): Promise<GroupRow | null> {
  const rows = await withTenantContext(ctx, (sql) => selectGroups(sql, sql`where g.id = ${id}`));
  return rows[0] ?? null;
}

export type GroupInput = {
  name: string;
  code: string;
  ageCategory: GroupAgeCategory;
  educatorId: string | null;
  pedagogicalAssistantId: string | null;
  childCount: number;
  description: string;
  academicYear: string;
  isActive: boolean;
};

export class DuplicateGroupCodeError extends Error {
  constructor(code: string) {
    super(`Топ коды бос емес: "${code}" қолданыста бар.`);
  }
}

export class GroupHasChildrenError extends Error {
  constructor() {
    super("Бұл топта балалар бар — алдымен оларды басқа топқа ауыстырыңыз немесе топты архивтеңіз.");
  }
}

/** Keeps teacher_groups (used by teacher.ts's getPrimaryGroup/getRoster)
 * in sync with a group's educator/assistant fields, so the teacher
 * cabinet reflects assignment changes without any query changes there.
 * (scripts/import-private-data.ts needs the identical shape but can't
 * import this file directly — this module starts with `server-only`,
 * which unconditionally throws outside the Next.js build system, so a
 * plain tsx script inlines the same 3 lines instead.) */
async function syncTeacherGroups(
  sql: Parameters<Parameters<typeof withTenantContext>[1]>[0],
  groupId: string,
  teacherIds: (string | null)[]
) {
  await sql`delete from teacher_groups where group_id = ${groupId}`;
  const uniqueIds = [...new Set(teacherIds.filter((id): id is string => !!id))];
  for (const teacherId of uniqueIds) {
    await sql`
      insert into teacher_groups (teacher_id, group_id) values (${teacherId}, ${groupId})
      on conflict do nothing
    `;
  }
}

export async function createGroup(ctx: TenantContext, input: GroupInput): Promise<GroupRow> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<{ id: string }[]>`select id from groups where code = ${input.code}`;
    if (existing[0]) throw new DuplicateGroupCodeError(input.code);

    const [created] = await sql<{ id: string }[]>`
      insert into groups (
        school_id, name, code, age_category, educator_id, pedagogical_assistant_id,
        child_count, description, academic_year, is_active
      ) values (
        ${ctx.schoolId}, ${input.name}, ${input.code}, ${input.ageCategory},
        ${input.educatorId}, ${input.pedagogicalAssistantId},
        ${input.childCount}, ${input.description}, ${input.academicYear}, ${input.isActive}
      )
      returning id
    `;
    await syncTeacherGroups(sql, created.id, [input.educatorId, input.pedagogicalAssistantId]);
    const rows = await selectGroups(sql, sql`where g.id = ${created.id}`);
    return rows[0];
  });
}

export async function updateGroup(ctx: TenantContext, id: string, input: GroupInput): Promise<GroupRow> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<{ id: string }[]>`select id from groups where code = ${input.code} and id <> ${id}`;
    if (existing[0]) throw new DuplicateGroupCodeError(input.code);

    await sql`
      update groups set
        name = ${input.name}, code = ${input.code}, age_category = ${input.ageCategory},
        educator_id = ${input.educatorId}, pedagogical_assistant_id = ${input.pedagogicalAssistantId},
        child_count = ${input.childCount}, description = ${input.description},
        academic_year = ${input.academicYear}, is_active = ${input.isActive}, updated_at = now()
      where id = ${id}
    `;
    await syncTeacherGroups(sql, id, [input.educatorId, input.pedagogicalAssistantId]);
    const rows = await selectGroups(sql, sql`where g.id = ${id}`);
    return rows[0];
  });
}

export async function archiveGroup(ctx: TenantContext, id: string): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`update groups set archived_at = now(), is_active = false, updated_at = now() where id = ${id}`
  );
}

export async function restoreGroup(ctx: TenantContext, id: string): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`update groups set archived_at = null, updated_at = now() where id = ${id}`
  );
}

/** Refuses to delete a group with linked children — archive instead.
 * Mirrors the spec's "байланысты топты бірден қатты жойма" guard. */
export async function deleteGroup(ctx: TenantContext, id: string): Promise<void> {
  await withTenantContext(ctx, async (sql) => {
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from users where group_id = ${id} and role = 'CHILD'
    `;
    if (count > 0) throw new GroupHasChildrenError();
    await sql`delete from teacher_groups where group_id = ${id}`;
    await sql`delete from groups where id = ${id}`;
  });
}

export type TeacherCandidate = { id: string; displayName: string };

export async function listEducatorCandidates(ctx: TenantContext): Promise<TeacherCandidate[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<TeacherCandidate[]>`
      select id, display_name as "displayName" from users
      where school_id = ${ctx.schoolId} and role = 'TEACHER'
      order by display_name
    `
  );
}

/** Whether the current CHILD session has a group assigned — used by the
 * child games page to show a soft "unassigned" notice (spec §11: the
 * system must never crash for an unassigned child, only inform). */
export async function hasAssignedGroup(ctx: TenantContext): Promise<boolean> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<{ groupId: string | null }[]>`select group_id as "groupId" from users where id = ${ctx.userId}`
  );
  return !!rows[0]?.groupId;
}
