import "server-only";
import path from "node:path";

/**
 * Single source of truth for where locally-stored uploads live on
 * disk — used by both the write path (LocalStorageAdapter.putObject,
 * local.ts) and the read path (src/app/uploads/[...path]/route.ts).
 * Deriving this independently in two places is exactly how uploaded
 * files ended up 404ing in production: Next's standalone build output
 * serves public/ from a snapshot frozen at build time, so a runtime
 * write under a *different* public/uploads (e.g. a Coolify volume
 * mounted at /app/public/uploads while the standalone server serves
 * from /app/.next/standalone/public) is invisible to it. Both sides
 * reading from this one function guarantees they can never diverge.
 */
export function getUploadRoot(): string {
  return process.env.UPLOAD_ROOT || path.join(process.cwd(), "public", "uploads");
}
