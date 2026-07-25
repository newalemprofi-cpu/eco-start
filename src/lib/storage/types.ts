export type PutObjectInput = {
  key: string; // e.g. "recognitions/2026/07/uuid.jpg"
  data: Buffer;
  contentType: string;
};

export type PutObjectResult = {
  url: string;
  key: string;
};

export interface StorageAdapter {
  readonly driver: "local" | "r2";
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
}

// Server-side upload validation shared by every route that accepts a file.
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export class StorageValidationError extends Error {}

export function validateImageUpload(file: { type: string; size: number }) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new StorageValidationError(
      `Unsupported file type "${file.type}". Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new StorageValidationError(
      `File too large (${Math.round(file.size / 1024)} KB). Max ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`
    );
  }
}

// News video uploads — separate from the image validation above (never
// reused/merged into it) so existing image behavior/limits/messages
// stay byte-for-byte unchanged. MOV maps to video/quicktime, which is
// what both Safari and most server-side tools report for .mov files.
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov"] as const;

function maxVideoBytes(): number {
  const mb = Number(process.env.MAX_VIDEO_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 100) * 1024 * 1024;
}

/** Kazakh error messages by design (item 15 of the news-video spec) —
 * this is a user-facing admin-form validation error, unlike
 * validateImageUpload's messages, which predate this requirement and
 * are left as-is to avoid changing existing behavior. */
export function validateVideoUpload(file: { type: string; size: number; name: string }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeOk = ALLOWED_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_TYPES)[number]);
  const extOk = (ALLOWED_VIDEO_EXTENSIONS as readonly string[]).includes(ext);
  if (!typeOk || !extOk) {
    throw new StorageValidationError(
      "Қолдау көрсетілмейтін бейне форматы. Рұқсат етілген форматтар: MP4, WebM, MOV."
    );
  }
  const maxBytes = maxVideoBytes();
  if (file.size > maxBytes) {
    throw new StorageValidationError(
      `Бейне файл тым үлкен (${Math.round(file.size / 1024 / 1024)} МБ). Рұқсат етілген максимум: ${Math.round(maxBytes / 1024 / 1024)} МБ.`
    );
  }
}
