import "server-only";
import { LocalStorageAdapter } from "@/lib/storage/local";
import { R2StorageAdapter } from "@/lib/storage/r2";
import type { StorageAdapter } from "@/lib/storage/types";

let cached: StorageAdapter | undefined;

/**
 * Chooses the storage adapter from environment configuration. Explicit
 * STORAGE_DRIVER=r2 with all R2 credentials present switches to
 * Cloudflare R2; anything else (including a fresh checkout with no
 * setup at all) falls back to local disk storage automatically.
 */
export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;

  const wantsR2 = process.env.STORAGE_DRIVER === "r2";
  const r2AccountId = process.env.R2_ACCOUNT_ID?.trim();
  const r2AccessKey = process.env.R2_ACCESS_KEY_ID?.trim();
  const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const r2Bucket = process.env.R2_BUCKET_NAME?.trim();
  const r2PublicUrl = process.env.R2_PUBLIC_URL?.trim();

  if (wantsR2 && r2AccountId && r2AccessKey && r2SecretKey && r2Bucket && r2PublicUrl) {
    cached = new R2StorageAdapter(r2AccountId, r2AccessKey, r2SecretKey, r2Bucket, r2PublicUrl);
  } else {
    cached = new LocalStorageAdapter();
  }
  return cached;
}

export * from "@/lib/storage/types";
