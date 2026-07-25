import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getUploadRoot } from "@/lib/storage/upload-root";
import { resolveSafePath } from "@/lib/storage/safe-path";
import { parseRange } from "@/lib/http/byte-range";

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
 *
 * Path-safety (resolveSafePath) and Range-header parsing (parseRange)
 * live in separate, "server-only"-free modules purely so they're
 * directly unit-testable — this file itself can't be imported from a
 * plain test (getUploadRoot() pulls in "server-only", which throws
 * outside the Next.js build system), but the two pieces of logic most
 * worth testing in isolation don't need to be affected by that.
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
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

async function resolveFile(segments: string[]): Promise<{ filePath: string; size: number } | null> {
  const filePath = resolveSafePath(getUploadRoot(), segments);
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

function fileHeaders(filePath: string, size: number): Record<string, string> {
  return {
    "content-type": contentTypeFor(filePath),
    "content-length": String(size),
    "cache-control": "public, max-age=31536000, immutable",
    // Video seeking (item 18) needs the browser to know Range is
    // supported before it ever sends one — this is that signal.
    "accept-ranges": "bytes",
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const resolved = await resolveFile(segments);
  if (!resolved) return new NextResponse(null, { status: 404 });

  const range = parseRange(req.headers.get("range"), resolved.size);
  if (range === "unsatisfiable") {
    return new NextResponse(null, {
      status: 416,
      headers: { "content-range": `bytes */${resolved.size}`, "accept-ranges": "bytes" },
    });
  }

  const headers = fileHeaders(resolved.filePath, resolved.size);
  // Streamed, not buffered — createReadStream + Readable.toWeb() never
  // holds the whole file (or even the whole requested range) in memory
  // at once, unlike readFile().
  if (range) {
    const chunkSize = range.end - range.start + 1;
    const body = Readable.toWeb(
      createReadStream(resolved.filePath, { start: range.start, end: range.end })
    ) as unknown as BodyInit;
    return new NextResponse(body, {
      status: 206,
      headers: {
        ...headers,
        "content-length": String(chunkSize),
        "content-range": `bytes ${range.start}-${range.end}/${resolved.size}`,
      },
    });
  }

  const body = Readable.toWeb(createReadStream(resolved.filePath)) as unknown as BodyInit;
  return new NextResponse(body, { status: 200, headers });
}

export async function HEAD(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const resolved = await resolveFile(segments);
  if (!resolved) return new NextResponse(null, { status: 404 });

  const range = parseRange(req.headers.get("range"), resolved.size);
  if (range === "unsatisfiable") {
    return new NextResponse(null, {
      status: 416,
      headers: { "content-range": `bytes */${resolved.size}`, "accept-ranges": "bytes" },
    });
  }

  const headers = fileHeaders(resolved.filePath, resolved.size);
  if (range) {
    const chunkSize = range.end - range.start + 1;
    return new NextResponse(null, {
      status: 206,
      headers: {
        ...headers,
        "content-length": String(chunkSize),
        "content-range": `bytes ${range.start}-${range.end}/${resolved.size}`,
      },
    });
  }

  return new NextResponse(null, { status: 200, headers });
}
