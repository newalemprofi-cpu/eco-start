import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getUploadRoot } from "@/lib/storage/upload-root";

/**
 * Serves files written to UPLOAD_ROOT at *runtime* (e.g. a Coolify
 * persistent volume mounted at /app/public/uploads) — Next's static
 * public/ serving only knows about files present in the build output
 * at build time (frozen into .next/standalone/public in a standalone
 * build), so anything uploaded after the image was built is otherwise
 * invisible and 404s. This route reads the filesystem live on every
 * request instead, so it works regardless of when the file was
 * written. Stored DB URLs are unaffected — they've always been plain
 * "/uploads/<key>" paths (see LocalStorageAdapter.putObject), which is
 * exactly what this route is mounted at.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

/**
 * Resolves the requested segments against UPLOAD_ROOT and verifies the
 * result is still inside it — rejects ".." segments outright (belt),
 * then re-checks after path.resolve() (suspenders: catches encoded/
 * combined traversal tricks a naive segment check could miss).
 */
function resolveSafePath(segments: string[]): string | null {
  if (segments.some((s) => s === ".." || s.includes("..") || s.includes("\0"))) return null;

  const uploadRoot = path.resolve(getUploadRoot());
  const requested = path.resolve(uploadRoot, ...segments);
  const rootWithSep = uploadRoot.endsWith(path.sep) ? uploadRoot : uploadRoot + path.sep;

  if (requested !== uploadRoot && !requested.startsWith(rootWithSep)) return null;
  return requested;
}

async function resolveFile(segments: string[]): Promise<{ filePath: string; size: number } | null> {
  const filePath = resolveSafePath(segments);
  if (!filePath) return null;
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return null;
    return { filePath, size: stats.size };
  } catch {
    // Real "not found"/permission errors both resolve to a plain 404 —
    // this is a public file server, not an API that should leak
    // filesystem details. (This is not the DB-error-hiding pattern the
    // rest of the app avoids: there's no business-logic error here to
    // observe, just "does a file exist at this path".)
    return null;
  }
}

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function fileHeaders(filePath: string, size: number): HeadersInit {
  return {
    "content-type": contentTypeFor(filePath),
    "content-length": String(size),
    "cache-control": "public, max-age=31536000, immutable",
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const resolved = await resolveFile(segments);
  if (!resolved) return new NextResponse(null, { status: 404 });

  // Streamed, not buffered — createReadStream + Readable.toWeb() never
  // holds the whole file in memory at once, unlike readFile().
  const body = Readable.toWeb(createReadStream(resolved.filePath)) as unknown as BodyInit;
  return new NextResponse(body, { status: 200, headers: fileHeaders(resolved.filePath, resolved.size) });
}

export async function HEAD(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const resolved = await resolveFile(segments);
  if (!resolved) return new NextResponse(null, { status: 404 });

  return new NextResponse(null, { status: 200, headers: fileHeaders(resolved.filePath, resolved.size) });
}
