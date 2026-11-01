import "server-only";
import type postgres from "postgres";
import { withTenantContext, type TenantContext } from "@/db/client";

/**
 * Editing, archiving and restoring the people of one kindergarten —
 * teachers / pedagogical assistants, children, parents.
 *
 * RBAC, enforced here (not only in the UI) on every write:
 *  - the caller is SCHOOL_ADMIN or SUPER_ADMIN (checked by the action);
 *  - the target must belong to the caller's own school AND have the
 *    expected role. SCHOOL_ADMIN / SUPER_ADMIN accounts are never a
 *    valid target, so no path here can demote, edit or lock out an
 *    administrator — and nothing here ever writes users.role;
 *  - nobody can archive themselves.
 * RLS (tenant_isolation on users) is the second fence underneath.
 *
 * Nothing is ever deleted: archiving sets archived_at and revokes the
 * account's sessions; every row that references the user (XP, games,
 * research, photos, audit trail) is left exactly as it was.
 */

export type ManagedRole = "TEACHER" | "CHILD" | "PARENT";
export type TeacherPosition = "main" | "assistant";

export type UserAdminErrorCode =
  | "not_found"
  | "email_taken"
  | "login_code_taken"
  | "group_not_found"
  | "slot_taken"
  | "cannot_archive_self";

export class UserAdminError extends Error {
  constructor(
    readonly code: UserAdminErrorCode,
    readonly detail?: string
  ) {
    super(code);
  }
}

type Tx = postgres.TransactionSql;

type ManagedUserRow = {
  id: string;
  role: ManagedRole;
  displayName: string;
  email: string | null;
  loginCode: string | null;
  phone: string | null;
  groupId: string | null;
  archivedAt: string | null;
};

/** The one gate every write goes through: same school, expected role,
 * row locked for the rest of the transaction. */
async function lockManagedUser(sql: Tx, ctx: TenantContext, id: string, role: ManagedRole): Promise<ManagedUserRow> {
  const [row] = await sql<ManagedUserRow[]>`
    select id, role, display_name as "displayName", email, login_code as "loginCode", phone,
           group_id as "groupId", archived_at as "archivedAt"
    from users
    where id = ${id} and school_id = ${ctx.schoolId} and role = ${role}
    for update
  `;
  if (!row) throw new UserAdminError("not_found");
  return row;
}

async function assertGroupInSchool(sql: Tx, ctx: TenantContext, groupId: string) {
  const [g] = await sql<{ id: string }[]>`
    select id from groups where id = ${groupId} and school_id = ${ctx.schoolId} and archived_at is null
  `;
  if (!g) throw new UserAdminError("group_not_found");
}

// ── Lists ────────────────────────────────────────────────────────────

export type ManagedTeacher = {
  id: string;
  displayName: string;
  email: string | null;
  groupId: string | null;
  groupName: string | null;
  position: TeacherPosition | null;
  childCount: number | null;
  archivedAt: string | null;
};

/** Teachers come with the group slot they hold (groups.educator_id →
 * "main", groups.pedagogical_assistant_id → "assistant"); a teacher
 * holding no slot falls back to a plain teacher_groups link. */
export async function listManagedTeachers(ctx: TenantContext, archived: boolean): Promise<ManagedTeacher[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ManagedTeacher[]>`
      select u.id, u.display_name as "displayName", u.email,
             coalesce(ge.id, gpa.id, gl.id) as "groupId",
             coalesce(ge.name, gpa.name, gl.name) as "groupName",
             case when ge.id is not null then 'main' when gpa.id is not null then 'assistant' else null end as "position",
             (select count(*)::int from users c
               where c.group_id = coalesce(ge.id, gpa.id, gl.id) and c.role = 'CHILD' and c.archived_at is null) as "childCount",
             u.archived_at as "archivedAt"
      from users u
      left join lateral (select id, name from groups where educator_id = u.id and school_id = u.school_id limit 1) ge on true
      left join lateral (select id, name from groups where pedagogical_assistant_id = u.id and school_id = u.school_id limit 1) gpa on true
      left join lateral (
        select g.id, g.name from teacher_groups tg join groups g on g.id = tg.group_id
        where tg.teacher_id = u.id limit 1
      ) gl on true
      where u.school_id = ${ctx.schoolId} and u.role = 'TEACHER'
        and (u.archived_at is not null) = ${archived}
      order by u.display_name
    `
  );
}

export type ManagedChild = {
  id: string;
  displayName: string;
  loginCode: string | null;
  groupId: string | null;
  groupName: string | null;
  xp: number;
  level: number;
  needsReview: boolean;
  archivedAt: string | null;
};

export async function listManagedChildren(ctx: TenantContext, archived: boolean): Promise<ManagedChild[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ManagedChild[]>`
      select u.id, u.display_name as "displayName", u.login_code as "loginCode",
             u.group_id as "groupId", g.name as "groupName", u.xp, u.level,
             u.needs_review as "needsReview", u.archived_at as "archivedAt"
      from users u
      left join groups g on g.id = u.group_id
      where u.school_id = ${ctx.schoolId} and u.role = 'CHILD'
        and (u.archived_at is not null) = ${archived}
      order by u.display_name
    `
  );
}

export type ManagedParent = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  archivedAt: string | null;
  children: { id: string; displayName: string }[];
};

export async function listManagedParents(ctx: TenantContext, archived: boolean): Promise<ManagedParent[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ManagedParent[]>`
      select u.id, u.display_name as "displayName", u.email, u.phone, u.archived_at as "archivedAt",
             coalesce((
               select json_agg(json_build_object('id', c.id, 'displayName', c.display_name) order by c.display_name)
               from parent_child_links l join users c on c.id = l.child_id
               where l.parent_id = u.id
             ), '[]'::json) as children
      from users u
      where u.school_id = ${ctx.schoolId} and u.role = 'PARENT'
        and (u.archived_at is not null) = ${archived}
      order by u.display_name
    `
  );
}

/** Active children of the school, for the parent "link a child" picker. */
export async function listLinkableChildren(ctx: TenantContext): Promise<{ id: string; displayName: string; groupName: string | null }[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<{ id: string; displayName: string; groupName: string | null }[]>`
      select u.id, u.display_name as "displayName", g.name as "groupName"
      from users u left join groups g on g.id = u.group_id
      where u.school_id = ${ctx.schoolId} and u.role = 'CHILD' and u.archived_at is null
      order by u.display_name
    `
  );
}

// ── Teachers ─────────────────────────────────────────────────────────

export type TeacherUpdate = {
  displayName: string;
  email: string;
  position: TeacherPosition;
  groupId: string | null;
  replaceExisting: boolean;
};

/** Returns before/after snapshots for the audit log. */
export async function updateTeacher(ctx: TenantContext, id: string, input: TeacherUpdate) {
  return withTenantContext(ctx, async (sql) => {
    const before = await lockManagedUser(sql, ctx, id, "TEACHER");
    const [taken] = await sql<{ id: string }[]>`select id from users where lower(email) = lower(${input.email}) and id <> ${id}`;
    if (taken) throw new UserAdminError("email_taken");

    const [prev] = await sql<{ groupId: string | null; position: TeacherPosition | null }[]>`
      select id as "groupId", case when educator_id = ${id} then 'main' else 'assistant' end as position
      from groups where school_id = ${ctx.schoolId} and (educator_id = ${id} or pedagogical_assistant_id = ${id})
      limit 1
    `;

    let displaced: string | null = null;
    if (input.groupId) {
      await assertGroupInSchool(sql, ctx, input.groupId);
      const [slot] = await sql<{ holderId: string | null; holderName: string | null }[]>`
        select u.id as "holderId", u.display_name as "holderName"
        from groups g
        left join users u on u.id = case when ${input.position} = 'main' then g.educator_id else g.pedagogical_assistant_id end
        where g.id = ${input.groupId}
      `;
      if (slot?.holderId && slot.holderId !== id) {
        if (!input.replaceExisting) throw new UserAdminError("slot_taken", slot.holderName ?? "");
        displaced = slot.holderId;
      }
    }

    await sql`
      update users set display_name = ${input.displayName}, email = ${input.email}, updated_at = now()
      where id = ${id}
    `;

    // Leave every slot this teacher held, then take the new one.
    await sql`update groups set educator_id = null, updated_at = now() where school_id = ${ctx.schoolId} and educator_id = ${id}`;
    await sql`
      update groups set pedagogical_assistant_id = null, updated_at = now()
      where school_id = ${ctx.schoolId} and pedagogical_assistant_id = ${id}
    `;
    await sql`delete from teacher_groups where teacher_id = ${id}`;
    if (input.groupId) {
      if (input.position === "main") {
        await sql`update groups set educator_id = ${id}, updated_at = now() where id = ${input.groupId}`;
      } else {
        await sql`update groups set pedagogical_assistant_id = ${id}, updated_at = now() where id = ${input.groupId}`;
      }
      await sql`insert into teacher_groups (teacher_id, group_id) values (${id}, ${input.groupId}) on conflict do nothing`;
    }
    if (displaced) {
      // The replaced teacher loses access to this group unless they still
      // hold its other slot.
      await sql`
        delete from teacher_groups tg
        where tg.teacher_id = ${displaced} and tg.group_id = ${input.groupId}
          and not exists (
            select 1 from groups g where g.id = tg.group_id
              and (g.educator_id = ${displaced} or g.pedagogical_assistant_id = ${displaced})
          )
      `;
    }

    return {
      before: { displayName: before.displayName, email: before.email, groupId: prev?.groupId ?? null, position: prev?.position ?? null },
      after: { displayName: input.displayName, email: input.email, groupId: input.groupId, position: input.position, displaced },
    };
  });
}

// ── Children ─────────────────────────────────────────────────────────

export type ChildUpdate = {
  displayName: string;
  loginCode: string;
  groupId: string | null;
  pinHash: string | null;
};

export async function updateChild(ctx: TenantContext, id: string, input: ChildUpdate) {
  return withTenantContext(ctx, async (sql) => {
    const before = await lockManagedUser(sql, ctx, id, "CHILD");
    const [taken] = await sql<{ id: string }[]>`select id from users where login_code = ${input.loginCode} and id <> ${id}`;
    if (taken) throw new UserAdminError("login_code_taken");
    if (input.groupId) await assertGroupInSchool(sql, ctx, input.groupId);

    await sql`
      update users set
        display_name = ${input.displayName},
        login_code = ${input.loginCode},
        group_id = ${input.groupId},
        -- an explicit group choice resolves the import's "needs review" flag
        needs_review = case when ${input.groupId}::uuid is not null then false else needs_review end,
        review_note = case when ${input.groupId}::uuid is not null then null else review_note end,
        pin_hash = coalesce(${input.pinHash}, pin_hash),
        sessions_revoked_at = case when ${input.pinHash}::text is not null then now() else sessions_revoked_at end,
        updated_at = now()
      where id = ${id}
    `;
    return {
      before: { displayName: before.displayName, loginCode: before.loginCode, groupId: before.groupId },
      after: { displayName: input.displayName, loginCode: input.loginCode, groupId: input.groupId, pinReset: !!input.pinHash },
    };
  });
}

/** Group move only (the "Топты өзгерту" action). */
export async function moveChildToGroup(ctx: TenantContext, id: string, groupId: string) {
  return withTenantContext(ctx, async (sql) => {
    const before = await lockManagedUser(sql, ctx, id, "CHILD");
    await assertGroupInSchool(sql, ctx, groupId);
    await sql`
      update users set group_id = ${groupId}, needs_review = false, review_note = null, updated_at = now()
      where id = ${id}
    `;
    return { before: { groupId: before.groupId }, after: { groupId } };
  });
}

// ── Parents ──────────────────────────────────────────────────────────

export type ParentUpdate = { displayName: string; email: string; phone: string | null };

export async function updateParent(ctx: TenantContext, id: string, input: ParentUpdate) {
  return withTenantContext(ctx, async (sql) => {
    const before = await lockManagedUser(sql, ctx, id, "PARENT");
    const [taken] = await sql<{ id: string }[]>`select id from users where lower(email) = lower(${input.email}) and id <> ${id}`;
    if (taken) throw new UserAdminError("email_taken");
    await sql`
      update users set display_name = ${input.displayName}, email = ${input.email}, phone = ${input.phone}, updated_at = now()
      where id = ${id}
    `;
    return {
      before: { displayName: before.displayName, email: before.email, phone: before.phone },
      after: input,
    };
  });
}

export async function linkParentToChild(ctx: TenantContext, parentId: string, childId: string) {
  return withTenantContext(ctx, async (sql) => {
    const parent = await lockManagedUser(sql, ctx, parentId, "PARENT");
    const child = await lockManagedUser(sql, ctx, childId, "CHILD");
    if (parent.archivedAt || child.archivedAt) throw new UserAdminError("not_found");
    const rows = await sql<{ id: string }[]>`
      insert into parent_child_links (parent_id, child_id, relation)
      values (${parentId}, ${childId}, 'parent')
      on conflict (parent_id, child_id) do nothing
      returning id
    `;
    return { created: rows.length > 0 };
  });
}

/** Removes the link row — from that moment every parent view of this
 * child (family dashboard, passport, certificates, photos) is refused,
 * because each of them checks parent_child_links live. */
export async function unlinkParentFromChild(ctx: TenantContext, parentId: string, childId: string) {
  return withTenantContext(ctx, async (sql) => {
    await lockManagedUser(sql, ctx, parentId, "PARENT");
    await lockManagedUser(sql, ctx, childId, "CHILD");
    const rows = await sql<{ id: string; relation: string; consentAt: string | null; createdAt: string }[]>`
      delete from parent_child_links where parent_id = ${parentId} and child_id = ${childId}
      returning id, relation, consent_at as "consentAt", created_at as "createdAt"
    `;
    return { removed: rows[0] ?? null };
  });
}

// ── Shared: password, archive, restore ──────────────────────────────

/** New password for a teacher or parent (children use PIN — see
 * updateChild). Every existing session of that account ends. */
export async function resetPassword(ctx: TenantContext, id: string, role: "TEACHER" | "PARENT", passwordHash: string) {
  await withTenantContext(ctx, async (sql) => {
    await lockManagedUser(sql, ctx, id, role);
    await sql`
      update users set password_hash = ${passwordHash}, sessions_revoked_at = now(), updated_at = now()
      where id = ${id}
    `;
  });
}

export async function archiveUser(ctx: TenantContext, id: string, role: ManagedRole) {
  if (id === ctx.userId) throw new UserAdminError("cannot_archive_self");
  return withTenantContext(ctx, async (sql) => {
    const before = await lockManagedUser(sql, ctx, id, role);
    if (before.archivedAt) return { changed: false };
    await sql`
      update users set archived_at = now(), archived_by = ${ctx.userId}, sessions_revoked_at = now(), updated_at = now()
      where id = ${id}
    `;
    return { changed: true };
  });
}

export async function restoreUser(ctx: TenantContext, id: string, role: ManagedRole) {
  return withTenantContext(ctx, async (sql) => {
    const before = await lockManagedUser(sql, ctx, id, role);
    if (!before.archivedAt) return { changed: false };
    await sql`update users set archived_at = null, archived_by = null, updated_at = now() where id = ${id}`;
    return { changed: true };
  });
}
