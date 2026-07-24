import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PutObjectInput, PutObjectResult, StorageAdapter } from "@/lib/storage/types";
import { getUploadRoot } from "@/lib/storage/upload-root";

/**
 * Local/self-hosted storage: writes under UPLOAD_ROOT (defaults to
 * /public/uploads for local dev). Files written after the Docker image
 * was built are served at runtime by src/app/uploads/[...path]/route.ts
 * — NOT by Next's static public/ handling, which only knows about
 * files present at build time. See that route's header comment.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local" as const;

  async putObject({ key, data }: PutObjectInput): Promise<PutObjectResult> {
    const destination = path.join(getUploadRoot(), key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, data);
    return { url: `/uploads/${key.split(path.sep).join("/")}`, key };
  }
}
