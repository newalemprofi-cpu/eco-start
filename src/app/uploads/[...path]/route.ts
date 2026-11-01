import { NextResponse } from "next/server";
import { classifyMediaKey } from "@/lib/storage/media-access";
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
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isPublic(segments: string[]): boolean {
  return classifyMediaKey(segments).type === "public";
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (!isPublic(segments)) return new NextResponse(null, { status: 404 });
  return serveLocalFile(req, segments, PUBLIC_CACHE);
}

export async function HEAD(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (!isPublic(segments)) return new NextResponse(null, { status: 404 });
  return serveLocalFile(req, segments, PUBLIC_CACHE, true);
}
