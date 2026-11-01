import { NextResponse } from "next/server";
import { getOptionalSession, toTenantContext } from "@/lib/auth/dal";
import { checkChildMediaAccess } from "@/db/repo/media-access";
import { getStorageAdapter } from "@/lib/storage";
import { R2StorageAdapter } from "@/lib/storage/r2";
import { classifyMediaKey } from "@/lib/storage/media-access";
import { PRIVATE_CACHE, serveLocalFile, serveR2Object } from "@/lib/storage/serve-file";

/**
 * Guarded file server for children's photos/media. Every
 * "/uploads/recognitions/…" and "/uploads/media/…" request — including
 * every URL already stored in the database — is rewritten here by
 * proxy.ts, so existing links keep working but now require a session
 * that passes checkChildMediaAccess (school → group → child → role).
 *
 *  401 — not signed in
 *  404 — signed in but not allowed, malformed key, or missing file
 *        (deliberately indistinguishable: no existence oracle)
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(req: Request, segments: string[], headOnly: boolean) {
  const file = classifyMediaKey(segments);
  if (file.type !== "private") return new NextResponse(null, { status: 404 });

  const session = await getOptionalSession();
  const decision = await checkChildMediaAccess(session ? toTenantContext(session) : null, file);
  if (decision === "unauthenticated") {
    return new NextResponse(null, { status: 401, headers: { "cache-control": PRIVATE_CACHE } });
  }
  if (decision !== "allow") {
    return new NextResponse(null, { status: 404, headers: { "cache-control": PRIVATE_CACHE } });
  }

  const storage = getStorageAdapter();
  if (storage instanceof R2StorageAdapter) {
    return serveR2Object(req, storage, file.key, PRIVATE_CACHE, headOnly);
  }
  return serveLocalFile(req, file.key.split("/"), PRIVATE_CACHE, headOnly);
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path, false);
}

export async function HEAD(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path, true);
}
