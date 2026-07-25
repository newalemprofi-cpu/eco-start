import "server-only";
import type { TenantContext } from "@/db/client";
import { getStorageAdapter, StorageValidationError, validateImageUpload, validateVideoUpload } from "@/lib/storage";
import { createMedia, type SiteMediaRow } from "@/db/repo/cms";

export type CmsMediaKind = "logo" | "favicon" | "banner" | "section" | "module" | "icon" | "news" | "other";

/**
 * Shared upload path for every SUPER_ADMIN media field (brand logos,
 * banner images, section/module images). Reuses the same storage
 * adapter and validation the child EcoLab uploader uses (see
 * src/app/[locale]/app/child/ecolab/actions.ts) rather than a
 * parallel implementation, and always records the upload in
 * site_media so the media library and "delete if unused" check stay
 * accurate.
 */
export async function uploadCmsMedia(
  ctx: TenantContext,
  kind: CmsMediaKind,
  file: File
): Promise<SiteMediaRow> {
  validateImageUpload({ type: file.type, size: file.size });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `site-media/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const storage = getStorageAdapter();
  const { url } = await storage.putObject({ key, data: buffer, contentType: file.type });

  return createMedia(ctx, {
    kind,
    url,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    alt: { kk: "", ru: "", en: "" },
  });
}

/**
 * News-specific video upload — a sibling of uploadCmsMedia, not a
 * variant of it: stored under a fixed site-media/news/videos/ prefix
 * (per the news-video spec) rather than the kind-based
 * site-media/<kind>/ layout uploadCmsMedia uses, and is NOT recorded
 * in site_media (that table has zero readers for news — listMedia has
 * no callers anywhere — so skipping it avoids growing an already-
 * unused audit table rather than adding real functionality). Video
 * metadata lives only on news_items.main_video_url/video_urls.
 */
export async function uploadNewsVideo(file: File): Promise<{ url: string }> {
  validateVideoUpload({ type: file.type, size: file.size, name: file.name });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  const key = `site-media/news/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const storage = getStorageAdapter();
  const { url } = await storage.putObject({ key, data: buffer, contentType: file.type });
  return { url };
}

export { StorageValidationError };
