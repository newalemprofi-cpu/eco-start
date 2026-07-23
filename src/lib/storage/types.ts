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
