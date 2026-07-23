"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { createChild, createParent, createTeacher, resolveChildGroup, setMediaStatus } from "@/db/repo/admin";
import { logAudit } from "@/db/repo/audit";
import { hashSecret } from "@/lib/auth/hash";
import { createChildSchema, createParentSchema, createTeacherSchema } from "@/lib/validation/admin";

export async function createTeacherAction(locale: string, formData: FormData) {
  const session = await requireRole("SCHOOL_ADMIN");
  const parsed = createTeacherSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    groupId: formData.get("groupId") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: "validation" };

  const ctx = toTenantContext(session);
  const passwordHash = await hashSecret(parsed.data.password);
  const teacher = await createTeacher(ctx, {
    displayName: parsed.data.displayName,
    email: parsed.data.email,
    passwordHash,
    groupId: parsed.data.groupId ?? null,
  });
  await logAudit(ctx, "create", "user:teacher", teacher.id, null, { email: parsed.data.email });

  revalidatePath(`/${locale}/app/admin/teachers`);
  return { ok: true as const };
}

export async function createChildAction(locale: string, formData: FormData) {
  const session = await requireRole("SCHOOL_ADMIN");
  const parsed = createChildSchema.safeParse({
    displayName: formData.get("displayName"),
    loginCode: formData.get("loginCode"),
    pin: formData.get("pin"),
    groupId: formData.get("groupId") || undefined,
    avatarUrl: formData.get("avatarUrl") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "validation" };
  }

  const ctx = toTenantContext(session);
  const pinHash = await hashSecret(parsed.data.pin);
  const child = await createChild(ctx, {
    displayName: parsed.data.displayName,
    loginCode: parsed.data.loginCode,
    pinHash,
    groupId: parsed.data.groupId ?? null,
    avatarUrl: parsed.data.avatarUrl || "🦉",
  });
  await logAudit(ctx, "create", "user:child", child.id, null, { loginCode: parsed.data.loginCode });

  revalidatePath(`/${locale}/app/admin/children`);
  return { ok: true as const };
}

export async function createParentAction(locale: string, formData: FormData) {
  const session = await requireRole("SCHOOL_ADMIN");
  const parsed = createParentSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false as const, error: "validation" };

  const ctx = toTenantContext(session);
  const passwordHash = await hashSecret(parsed.data.password);
  const parent = await createParent(ctx, {
    displayName: parsed.data.displayName,
    email: parsed.data.email,
    passwordHash,
  });
  await logAudit(ctx, "create", "user:parent", parent.id, null, { email: parsed.data.email });

  revalidatePath(`/${locale}/app/admin/parents`);
  return { ok: true as const };
}

export async function resolveChildGroupAction(locale: string, childId: string, groupId: string) {
  if (!childId || !groupId) return { ok: false as const, error: "validation" };
  const session = await requireRole("SCHOOL_ADMIN");
  const ctx = toTenantContext(session);
  await resolveChildGroup(ctx, childId, groupId);
  await logAudit(ctx, "resolve_review", "user:child", childId, null, { groupId });

  revalidatePath(`/${locale}/app/admin/children`);
  return { ok: true as const };
}

export async function setMediaStatusAction(
  locale: string,
  mediaId: string,
  status: "private" | "shared_family" | "shared_school"
) {
  const session = await requireRole("SCHOOL_ADMIN");
  const ctx = toTenantContext(session);
  await setMediaStatus(ctx, mediaId, status);
  await logAudit(ctx, "update_status", "media_asset", mediaId, null, { status });
  revalidatePath(`/${locale}/app/admin/content`);
}
