import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type SchoolCounts = {
  teachers: number;
  children: number;
  parents: number;
  groups: number;
  aiCalls: number;
};

export async function getSchoolOverview(ctx: TenantContext): Promise<SchoolCounts> {
  return withTenantContext(ctx, async (sql) => {
    const [row] = await sql<SchoolCounts[]>`
      select
        (select count(*)::int from users where school_id = ${ctx.schoolId} and role = 'TEACHER') as teachers,
        (select count(*)::int from users where school_id = ${ctx.schoolId} and role = 'CHILD') as children,
        (select count(*)::int from users where school_id = ${ctx.schoolId} and role = 'PARENT') as parents,
        (select count(*)::int from groups where school_id = ${ctx.schoolId}) as groups,
        (select count(*)::int from ai_logs where school_id = ${ctx.schoolId}) as "aiCalls"
    `;
    return row;
  });
}

export type SchoolUserRow = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  loginCode: string | null;
  groupName: string | null;
  xp: number | null;
  level: number | null;
  createdAt: string;
};

export async function listUsersByRole(
  ctx: TenantContext,
  role: "TEACHER" | "CHILD" | "PARENT"
): Promise<SchoolUserRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<SchoolUserRow[]>`
      select u.id, u.display_name as "displayName", u.email, u.phone, u.login_code as "loginCode",
             g.name as "groupName", u.xp, u.level, u.created_at as "createdAt"
      from users u
      left join groups g on g.id = u.group_id
      where u.school_id = ${ctx.schoolId} and u.role = ${role}
      order by u.created_at desc
    `
  );
}

export type TeacherRow = {
  id: string;
  displayName: string;
  email: string | null;
  groupName: string | null;
  groupCode: string | null;
  roleType: "main" | "assistant" | null;
  childCount: number | null;
  createdAt: string;
};

/** TEACHER-role users aren't linked to a group via users.group_id (that
 * column is CHILD-only) — a teacher/pedagogical-assistant's group comes
 * from groups.educator_id / groups.pedagogical_assistant_id instead (see
 * scripts/import-private-data.ts). listUsersByRole's plain group_id join
 * would show every teacher as unassigned, so the admin Teachers page
 * uses this dedicated query instead. */
export async function listTeachersWithGroups(ctx: TenantContext): Promise<TeacherRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<TeacherRow[]>`
      select u.id, u.display_name as "displayName", u.email,
             coalesce(ge.name, gpa.name) as "groupName",
             coalesce(ge.code, gpa.code) as "groupCode",
             case when ge.id is not null then 'main' when gpa.id is not null then 'assistant' else null end as "roleType",
             coalesce(ge.child_count, gpa.child_count) as "childCount",
             u.created_at as "createdAt"
      from users u
      left join groups ge on ge.educator_id = u.id and ge.school_id = u.school_id
      left join groups gpa on gpa.pedagogical_assistant_id = u.id and gpa.school_id = u.school_id
      where u.school_id = ${ctx.schoolId} and u.role = 'TEACHER'
      order by u.display_name
    `
  );
}

export async function listGroups(ctx: TenantContext) {
  return withTenantContext(
    ctx,
    (sql) => sql<{ id: string; name: string; code: string }[]>`
      select id, name, code from groups
      where school_id = ${ctx.schoolId} and archived_at is null
      order by name
    `
  );
}

export type NeedsReviewChild = {
  id: string;
  displayName: string;
  loginCode: string | null;
  candidateGroupCodes: string[];
};

/** Children whose group couldn't be determined automatically — see
 * scripts/import-private-data.ts: an Excel row listed under two
 * different groups collapses into one child with group_id = null and
 * needs_review = true instead of two duplicate user records. An admin
 * resolves each one via resolveChildGroup below. */
export async function listNeedsReviewChildren(ctx: TenantContext): Promise<NeedsReviewChild[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<NeedsReviewChild[]>`
      select id, display_name as "displayName", login_code as "loginCode",
             coalesce(review_note->'candidateGroupCodes', '[]'::jsonb) as "candidateGroupCodes"
      from users
      where school_id = ${ctx.schoolId} and role = 'CHILD' and needs_review = true
      order by display_name
    `
  );
}

export async function resolveChildGroup(ctx: TenantContext, childId: string, groupId: string): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`
      update users set group_id = ${groupId}, needs_review = false, review_note = null, updated_at = now()
      where id = ${childId} and school_id = ${ctx.schoolId} and role = 'CHILD'
    `
  );
}

export async function createTeacher(
  ctx: TenantContext,
  input: { displayName: string; email: string; passwordHash: string; groupId: string | null }
): Promise<{ id: string }> {
  return withTenantContext(ctx, async (sql) => {
    const [teacher] = await sql<{ id: string }[]>`
      insert into users (school_id, role, email, password_hash, display_name, group_id)
      values (${ctx.schoolId}, 'TEACHER', ${input.email}, ${input.passwordHash}, ${input.displayName}, ${input.groupId})
      returning id
    `;
    if (input.groupId) {
      await sql`insert into teacher_groups (teacher_id, group_id) values (${teacher.id}, ${input.groupId})`;
    }
    return teacher;
  });
}

export async function createChild(
  ctx: TenantContext,
  input: { displayName: string; loginCode: string; pinHash: string; groupId: string | null; avatarUrl: string }
): Promise<{ id: string }> {
  const [row] = await withTenantContext(
    ctx,
    (sql) => sql<{ id: string }[]>`
      insert into users (school_id, role, login_code, pin_hash, display_name, avatar_url, group_id)
      values (${ctx.schoolId}, 'CHILD', ${input.loginCode}, ${input.pinHash}, ${input.displayName}, ${input.avatarUrl}, ${input.groupId})
      returning id
    `
  );
  return row;
}

export async function createParent(
  ctx: TenantContext,
  input: { displayName: string; email: string; passwordHash: string }
): Promise<{ id: string }> {
  const [row] = await withTenantContext(
    ctx,
    (sql) => sql<{ id: string }[]>`
      insert into users (school_id, role, email, password_hash, display_name)
      values (${ctx.schoolId}, 'PARENT', ${input.email}, ${input.passwordHash}, ${input.displayName})
      returning id
    `
  );
  return row;
}

export type RecentMedia = {
  id: string;
  title: string;
  type: string;
  status: string;
  childName: string | null;
  createdAt: string;
};

export async function listRecentMedia(ctx: TenantContext, limit = 20): Promise<RecentMedia[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<RecentMedia[]>`
      select m.id, m.title, m.type, m.status, u.display_name as "childName", m.created_at as "createdAt"
      from media_assets m
      left join users u on u.id = m.child_id
      where m.school_id = ${ctx.schoolId}
      order by m.created_at desc
      limit ${limit}
    `
  );
}

export async function setMediaStatus(
  ctx: TenantContext,
  mediaId: string,
  status: "private" | "shared_family" | "shared_school"
): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`update media_assets set status = ${status} where id = ${mediaId} and school_id = ${ctx.schoolId}`
  );
}
