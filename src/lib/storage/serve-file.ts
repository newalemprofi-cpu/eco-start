import "server-only";
import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getUploadRoot } from "@/lib/storage/upload-root";
import { resolveSafePath } from "@/lib/storage/safe-path";
import { parseRange } from "@/lib/http/byte-range";
import type { R2StorageAdapter } from "@/lib/storage/r2";

// Shared by the public file route (/uploads/…, CMS content) and the
// guarded child-media route (/api/media/…). Moved here unchanged from
// src/app/uploads/[...path]/route.ts so both stream files, honour Range
// requests and guard paths identically — they differ only in who may
// ask and in the cache headers.

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

export const PUBLIC_CACHE = "public, max-age=31536000, immutable";
/** Children's media: never stored by shared caches/CDNs or reused across users. */
export const PRIVATE_CACHE = "private, no-store";

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function baseHeaders(contentType: string, size: number, cacheControl: string): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": contentType,
    "content-length": String(size),
    "cache-control": cacheControl,
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  };
  if (cacheControl === PRIVATE_CACHE) headers.vary = "Cookie";
  return headers;
}

async function resolveFile(segments: string[]): Promise<{ filePath: string; size: number } | null> {
  const filePath = resolveSafePath(getUploadRoot(), segments);
  if (!filePath) return null;
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return null;
    return { filePath, size: stats.size };
  } catch {
    // Missing file and permission errors both resolve to a plain 404 —
    // no filesystem detail leaks out.
    return null;
  }
}

export async function serveLocalFile(
  req: Request,
  segments: string[],
  cacheControl: string,
  headOnly = false
): Promise<NextResponse> {
  const resolved = await resolveFile(segments);
  if (!resolved) return new NextResponse(null, { status: 404 });

  const range = parseRange(req.headers.get("range"), resolved.size);
  if (range === "unsatisfiable") {
    return new NextResponse(null, {
      status: 416,
      headers: { "content-range": `bytes */${resolved.size}`, "accept-ranges": "bytes" },
    });
  }

  const headers = baseHeaders(contentTypeFor(resolved.filePath), resolved.size, cacheControl);
  if (range) {
    const chunkSize = range.end - range.start + 1;
    const body = headOnly
      ? null
      : (Readable.toWeb(createReadStream(resolved.filePath, { start: range.start, end: range.end })) as unknown as BodyInit);
    return new NextResponse(body, {
      status: 206,
      headers: {
        ...headers,
        "content-length": String(chunkSize),
        "content-range": `bytes ${range.start}-${range.end}/${resolved.size}`,
      },
    });
  }

  const body = headOnly ? null : (Readable.toWeb(createReadStream(resolved.filePath)) as unknown as BodyInit);
  return new NextResponse(body, { status: 200, headers });
}

/** Streams a private object from R2 through the app (the bucket URL is
 * never handed to the browser for children's media). */
export async function serveR2Object(
  req: Request,
  adapter: R2StorageAdapter,
  key: string,
  cacheControl: string,
  headOnly = false
): Promise<NextResponse> {
  const object = await adapter.getObject(key, req.headers.get("range"));
  if (!object) return new NextResponse(null, { status: 404 });
  const headers = baseHeaders(object.contentType ?? contentTypeFor(key), object.contentLength, cacheControl);
  if (object.contentRange) headers["content-range"] = object.contentRange;
  return new NextResponse(headOnly ? null : (object.body as BodyInit), {
    status: object.contentRange ? 206 : 200,
    headers,
  });
}
