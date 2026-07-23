"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { logAudit } from "@/db/repo/audit";
import {
  archiveGroup,
  createGroup,
  deleteGroup,
  restoreGroup,
  updateGroup,
  DuplicateGroupCodeError,
  GroupHasChildrenError,
  type GroupInput,
} from "@/db/repo/groups";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Reachable by SUPER_ADMIN and SCHOOL_ADMIN (no plain "ADMIN" role exists
// in this codebase, no fine-grained permission system either — see the
// approved plan). RLS's existing groups.tenant_isolation policy scopes a
// SCHOOL_ADMIN's writes to their own school automatically.
async function requireGroupManager() {
  return requireRole("SUPER_ADMIN", "SCHOOL_ADMIN");
}

function revalidateGroups(locale: string) {
  revalidatePath(`/${locale}/app/super-admin/groups`);
  revalidatePath(`/${locale}/app/admin/groups`);
  revalidatePath(`/${locale}/app/admin/children`);
  revalidatePath(`/${locale}/app/teacher`);
}

export async function createGroupAction(locale: string, input: GroupInput): Promise<ActionResult> {
  const session = await requireGroupManager();
  const ctx = toTenantContext(session);
  try {
    const created = await createGroup(ctx, input);
    await logAudit(ctx, "create", "groups", created.id, null, created);
    revalidateGroups(locale);
    return { ok: true };
  } catch (err) {
    if (err instanceof DuplicateGroupCodeError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function updateGroupAction(locale: string, id: string, input: GroupInput): Promise<ActionResult> {
  const session = await requireGroupManager();
  const ctx = toTenantContext(session);
  try {
    const updated = await updateGroup(ctx, id, input);
    await logAudit(ctx, "update", "groups", id, null, updated);
    revalidateGroups(locale);
    return { ok: true };
  } catch (err) {
    if (err instanceof DuplicateGroupCodeError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function archiveGroupAction(locale: string, id: string): Promise<ActionResult> {
  const session = await requireGroupManager();
  const ctx = toTenantContext(session);
  await archiveGroup(ctx, id);
  await logAudit(ctx, "archive", "groups", id, null, { id });
  revalidateGroups(locale);
  return { ok: true };
}

export async function restoreGroupAction(locale: string, id: string): Promise<ActionResult> {
  const session = await requireGroupManager();
  const ctx = toTenantContext(session);
  await restoreGroup(ctx, id);
  await logAudit(ctx, "restore", "groups", id, null, { id });
  revalidateGroups(locale);
  return { ok: true };
}

export async function deleteGroupAction(locale: string, id: string): Promise<ActionResult> {
  const session = await requireGroupManager();
  const ctx = toTenantContext(session);
  try {
    await deleteGroup(ctx, id);
    await logAudit(ctx, "delete", "groups", id, null, null);
    revalidateGroups(locale);
    return { ok: true };
  } catch (err) {
    if (err instanceof GroupHasChildrenError) return { ok: false, error: err.message };
    throw err;
  }
}
