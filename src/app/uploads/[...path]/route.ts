import { NextResponse } from "next/server";
import { classifyMediaKey } from "@/lib/storage/media-access";
import { logMediaMiss } from "@/lib/storage/media-diagnostics";
import { PUBLIC_CACHE, serveLocalFile } from "@/lib/storage/serve-file";

/**
 * Serves PUBLIC files written to UPLOAD_ROOT at *runtime* (news photos
 * and videos, banners, logos under site-media/) — Next's static
 * public/ serving only knows about files present at build time, so
 * anything uploaded later would otherwise 404. Streaming, Range and
 * path-safety live in src/lib/storage/serve-file.ts.
 *
 * Children's media (recognitions/, media/) is NOT served here: proxy.ts
 * rewrites those paths to the guarded /api/media/… handler, and this
 * route refuses them as well in case that rewrite is ever bypassed —
 * a 404, so it doesn't even confirm the file exists.
 *
 * A public file that is simply gone (e.g. the container lost a
 * non-persistent UPLOAD_ROOT on redeploy) answers 404 with
 * `x-media-reason: file-missing` and a server log line — it's public
 * content, so saying so reveals nothing.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isPublic(segments: string[]): boolean {
  return classifyMediaKey(segments).type === "public";
}

async function handle(req: Request, segments: string[], headOnly: boolean) {
  if (!isPublic(segments)) return new NextResponse(null, { status: 404 });
  const res = await serveLocalFile(req, segments, PUBLIC_CACHE, headOnly);
  if (res.status === 404) {
    logMediaMiss("file_missing", { kind: "public", key: segments.join("/"), driver: "local" });
    res.headers.set("x-media-reason", "file-missing");
  }
  return res;
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path, false);
}

export async function HEAD(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path, true);
}
