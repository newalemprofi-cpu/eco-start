"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { logAudit } from "@/db/repo/audit";
import { uploadCmsMedia, StorageValidationError } from "@/lib/cms/upload";
import {
  createNewsDraft,
  deleteNews,
  publishNews,
  reorderFeaturedNews,
  saveNewsDraft,
  unpublishNews,
  type NewsItemRow,
} from "@/db/repo/news";

export type ActionResult = { ok: true } | { ok: false; error: string };

// news-editor.tsx passes its whole row-shaped form state as `patch` (same
// convention as banners-editor.tsx), so system-managed columns need
// stripping before the repo layer builds its dynamic SQL SET clause —
// otherwise `version` collides with the repo's own `version = version + 1`
// (see the identical SYSTEM_FIELDS/stripSystemFields in
// super-admin/homepage/actions.ts, the pattern this mirrors).
const SYSTEM_FIELDS = ["id", "status", "version", "created_at", "created_by", "updated_at", "updated_by", "published_at"] as const;

function stripSystemFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out = { ...obj };
  for (const field of SYSTEM_FIELDS) delete out[field as keyof T];
  return out;
}

function revalidateNews(locale: string, slug?: string) {
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/news`);
  if (slug) revalidatePath(`/${locale}/news/${slug}`);
  revalidatePath(`/${locale}/app/super-admin/news`);
}

export async function createNewsAction(locale: string): Promise<ActionResult & { groupId?: string }> {
  const session = await requireRole("SUPER_ADMIN");
  const ctx = toTenantContext(session);
  const created = await createNewsDraft(ctx);
  await logAudit(ctx, "create", "news_items", created.group_id, null, created);
  revalidateNews(locale);
  return { ok: true, groupId: created.group_id };
}

export async function saveNewsAction(
  locale: string,
  groupId: string,
  patch: Partial<Omit<NewsItemRow, "id" | "group_id" | "status" | "version" | "updated_at" | "published_at">>
): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN");
  await saveNewsDraft(toTenantContext(session), groupId, stripSystemFields(patch));
  revalidateNews(locale, patch.slug);
  return { ok: true };
}

export async function publishNewsAction(locale: string, groupId: string): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN");
  const ctx = toTenantContext(session);
  await publishNews(ctx, groupId);
  await logAudit(ctx, "publish", "news_items", groupId, null, { groupId });
  revalidateNews(locale);
  return { ok: true };
}

export async function unpublishNewsAction(locale: string, groupId: string): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN");
  const ctx = toTenantContext(session);
  await unpublishNews(ctx, groupId);
  await logAudit(ctx, "unpublish", "news_items", groupId, null, { groupId });
  revalidateNews(locale);
  return { ok: true };
}

export async function deleteNewsAction(locale: string, groupId: string): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN");
  const ctx = toTenantContext(session);
  await deleteNews(ctx, groupId);
  await logAudit(ctx, "delete", "news_items", groupId, null, null);
  revalidateNews(locale);
  return { ok: true };
}

export async function reorderNewsAction(locale: string, orderedGroupIds: string[]): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN");
  await reorderFeaturedNews(toTenantContext(session), orderedGroupIds);
  revalidateNews(locale);
  return { ok: true };
}

export async function uploadNewsMediaAction(
  locale: string,
  formData: FormData
): Promise<ActionResult & { url?: string }> {
  const session = await requireRole("SUPER_ADMIN");
  const ctx = toTenantContext(session);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file" };

  try {
    const media = await uploadCmsMedia(ctx, "news", file);
    revalidatePath(`/${locale}/app/super-admin/news`);
    return { ok: true, url: media.url };
  } catch (err) {
    if (err instanceof StorageValidationError) return { ok: false, error: err.message };
    throw err;
  }
}
