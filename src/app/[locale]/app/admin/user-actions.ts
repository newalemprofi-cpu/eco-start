"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { hashSecret } from "@/lib/auth/hash";
import { logAudit } from "@/db/repo/audit";
import {
  archiveUser,
  linkParentToChild,
  moveChildToGroup,
  resetPassword,
  restoreUser,
  unlinkParentFromChild,
  updateChild,
  updateParent,
  updateTeacher,
  UserAdminError,
  type ManagedRole,
  type UserAdminErrorCode,
} from "@/db/repo/user-admin";
import {
  linkParentSchema,
  resetPasswordSchema,
  updateChildSchema,
  updateParentSchema,
  updateTeacherSchema,
} from "@/lib/validation/admin";
import { z } from "zod";

// Release 2 user management. Every action re-checks the role here and
// the target's school + role inside src/db/repo/user-admin.ts, and every
// change (including link removal and archiving) goes to audit_logs.
// No secret (password/PIN or its hash) is ever written to the audit log.

export type UserActionResult = { ok: true } | { ok: false; error: UserAdminErrorCode | "validation"; detail?: string };

const ENTITY: Record<ManagedRole, string> = { TEACHER: "user:teacher", CHILD: "user:child", PARENT: "user:parent" };
const PAGE: Record<ManagedRole, string> = { TEACHER: "teachers", CHILD: "children", PARENT: "parents" };

async function adminContext() {
  const session = await requireRole("SCHOOL_ADMIN", "SUPER_ADMIN");
  return toTenantContext(session);
}

function refresh(locale: string, role: ManagedRole) {
  revalidatePath(`/${locale}/app/admin/${PAGE[role]}`);
  revalidatePath(`/${locale}/app/admin`);
}

async function guarded(fn: () => Promise<void>): Promise<UserActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    if (err instanceof UserAdminError) return { ok: false, error: err.code, detail: err.detail };
    throw err;
  }
}

function fields(formData: FormData) {
  return Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
}

export async function updateTeacherAction(locale: string, formData: FormData): Promise<UserActionResult> {
  const ctx = await adminContext();
  const parsed = updateTeacherSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: "validation" };
  const { id, ...input } = parsed.data;
  return guarded(async () => {
    const { before, after } = await updateTeacher(ctx, id, input);
    await logAudit(ctx, "update", ENTITY.TEACHER, id, before, after);
    if (after.displaced) {
      await logAudit(ctx, "unassign_group", ENTITY.TEACHER, after.displaced, { groupId: input.groupId }, { replacedBy: id });
    }
    refresh(locale, "TEACHER");
    revalidatePath(`/${locale}/app/super-admin/groups`);
  });
}

export async function updateChildAction(locale: string, formData: FormData): Promise<UserActionResult> {
  const ctx = await adminContext();
  const parsed = updateChildSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: "validation" };
  const { id, pin, ...input } = parsed.data;
  return guarded(async () => {
    const pinHash = pin ? await hashSecret(pin) : null;
    const { before, after } = await updateChild(ctx, id, { ...input, pinHash });
    await logAudit(ctx, "update", ENTITY.CHILD, id, before, after);
    refresh(locale, "CHILD");
  });
}

export async function moveChildAction(locale: string, childId: string, groupId: string): Promise<UserActionResult> {
  const ctx = await adminContext();
  const parsed = z.object({ childId: z.uuid(), groupId: z.uuid() }).safeParse({ childId, groupId });
  if (!parsed.success) return { ok: false, error: "validation" };
  return guarded(async () => {
    const { before, after } = await moveChildToGroup(ctx, parsed.data.childId, parsed.data.groupId);
    await logAudit(ctx, "move_group", ENTITY.CHILD, parsed.data.childId, before, after);
    refresh(locale, "CHILD");
  });
}

export async function updateParentAction(locale: string, formData: FormData): Promise<UserActionResult> {
  const ctx = await adminContext();
  const parsed = updateParentSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: "validation" };
  const { id, ...input } = parsed.data;
  return guarded(async () => {
    const { before, after } = await updateParent(ctx, id, input);
    await logAudit(ctx, "update", ENTITY.PARENT, id, before, after);
    refresh(locale, "PARENT");
  });
}

export async function resetPasswordAction(
  locale: string,
  role: "TEACHER" | "PARENT",
  formData: FormData
): Promise<UserActionResult> {
  const ctx = await adminContext();
  if (role !== "TEACHER" && role !== "PARENT") return { ok: false, error: "validation" };
  const parsed = resetPasswordSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: "validation" };
  return guarded(async () => {
    await resetPassword(ctx, parsed.data.id, role, await hashSecret(parsed.data.password));
    await logAudit(ctx, "reset_password", ENTITY[role], parsed.data.id, null, { sessionsRevoked: true });
    refresh(locale, role);
  });
}

export async function setUserArchivedAction(
  locale: string,
  role: ManagedRole,
  userId: string,
  archived: boolean
): Promise<UserActionResult> {
  const ctx = await adminContext();
  if (!Object.hasOwn(ENTITY, role) || !z.uuid().safeParse(userId).success) return { ok: false, error: "validation" };
  return guarded(async () => {
    const { changed } = archived ? await archiveUser(ctx, userId, role) : await restoreUser(ctx, userId, role);
    if (changed) await logAudit(ctx, archived ? "archive" : "restore", ENTITY[role], userId, null, null);
    refresh(locale, role);
  });
}

export async function setParentLinkAction(
  locale: string,
  parentId: string,
  childId: string,
  linked: boolean
): Promise<UserActionResult> {
  const ctx = await adminContext();
  const parsed = linkParentSchema.safeParse({ parentId, childId });
  if (!parsed.success) return { ok: false, error: "validation" };
  return guarded(async () => {
    if (linked) {
      const { created } = await linkParentToChild(ctx, parsed.data.parentId, parsed.data.childId);
      if (created) await logAudit(ctx, "link_child", ENTITY.PARENT, parsed.data.parentId, null, { childId: parsed.data.childId });
    } else {
      const { removed } = await unlinkParentFromChild(ctx, parsed.data.parentId, parsed.data.childId);
      // A DELETE: the removed row itself goes to the audit log.
      if (removed) await logAudit(ctx, "unlink_child", ENTITY.PARENT, parsed.data.parentId, { childId: parsed.data.childId, link: removed }, null);
    }
    refresh(locale, "PARENT");
  });
}
