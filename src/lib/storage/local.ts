import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PutObjectInput, PutObjectResult, StorageAdapter } from "@/lib/storage/types";

/**
 * Local-dev storage: writes under /public/uploads so Next.js serves the
 * files directly with zero extra routing. Never used in production
 * (STORAGE_DRIVER=r2 switches to R2 automatically — see r2.ts).
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local" as const;

  async putObject({ key, data }: PutObjectInput): Promise<PutObjectResult> {
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    const destination = path.join(uploadsRoot, key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, data);
    return { url: `/uploads/${key.split(path.sep).join("/")}`, key };
  }
}
