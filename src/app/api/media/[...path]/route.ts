import { NextResponse } from "next/server";
import { getOptionalSession, toTenantContext } from "@/lib/auth/dal";
import { checkChildMediaAccess } from "@/db/repo/media-access";
import { getStorageAdapter } from "@/lib/storage";
import { R2StorageAdapter } from "@/lib/storage/r2";
import { classifyMediaKey } from "@/lib/storage/media-access";
import { logMediaMiss } from "@/lib/storage/media-diagnostics";
import { PRIVATE_CACHE, serveLocalFile, serveR2Object } from "@/lib/storage/serve-file";

/**
 * Guarded file server for children's photos/media. Every
 * "/uploads/recognitions/…" and "/uploads/media/…" request — including
 * every URL already stored in the database — is rewritten here by
 * proxy.ts, so existing links keep working but now require a session
 * that passes checkChildMediaAccess (school → group → child → role).
 *
 *  401 — not signed in (or the session was revoked / account archived)
 *  404 — signed in but not allowed, malformed key, or missing file
 *        (deliberately indistinguishable to the client: no existence
 *        oracle). The real reason is written to the server log, and a
 *        viewer who IS allowed to see the file additionally gets
 *        `x-media-reason: file-missing` when the bytes are gone — so a
 *        "broken photo" can be told apart from an access problem in the
 *        browser's network tab without revealing anything to others.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(req: Request, segments: string[], headOnly: boolean) {
  const file = classifyMediaKey(segments);
  if (file.type !== "private") {
    logMediaMiss("invalid_key", { path: segments.join("/") });
    return new NextResponse(null, { status: 404, headers: { "cache-control": PRIVATE_CACHE } });
  }

  const session = await getOptionalSession();
  const decision = await checkChildMediaAccess(session ? toTenantContext(session) : null, file);
  if (decision === "unauthenticated") {
    logMediaMiss("unauthenticated", { kind: file.kind });
    return new NextResponse(null, { status: 401, headers: { "cache-control": PRIVATE_CACHE } });
  }
  if (decision !== "allow") {
    logMediaMiss("denied", { kind: file.kind, role: session?.role });
    return new NextResponse(null, { status: 404, headers: { "cache-control": PRIVATE_CACHE } });
  }

  const storage = getStorageAdapter();
  const res =
    storage instanceof R2StorageAdapter
      ? await serveR2Object(req, storage, file.key, PRIVATE_CACHE, headOnly)
      : await serveLocalFile(req, file.key.split("/"), PRIVATE_CACHE, headOnly);
  if (res.status === 404) {
    logMediaMiss("file_missing", { kind: file.kind, key: file.key, driver: storage.driver });
    res.headers.set("x-media-reason", "file-missing");
    res.headers.set("cache-control", PRIVATE_CACHE);
  }
  return res;
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path, false);
}

export async function HEAD(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path, true);
}
