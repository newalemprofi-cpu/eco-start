// Pure HTTP Range-header parsing — deliberately has no "server-only"
// import (unlike the route that uses it), so it can be unit-tested
// directly with vitest. See src/app/uploads/[...path]/route.ts, the
// one caller.

export type ByteRange = { start: number; end: number };

/**
 * Parses a single-range `Range: bytes=start-end` header (the only form
 * browsers send for `<video>` seeking — multi-range isn't needed here).
 * Returns:
 *   - null            → no Range header, or it's not a bytes range: serve the full file.
 *   - "unsatisfiable"  → a Range header was present but invalid/out of
 *                        bounds for this file's size: caller must reply 416.
 *   - {start, end}     → a valid, in-bounds range to serve as 206.
 */
export function parseRange(rangeHeader: string | null, size: number): ByteRange | "unsatisfiable" | null {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null; // not a bytes range we understand — fall back to a full response

  const [, startStr, endStr] = match;
  if (startStr === "" && endStr === "") return "unsatisfiable";

  let start: number;
  let end: number;
  if (startStr === "") {
    // Suffix range: "bytes=-500" = last 500 bytes.
    const suffixLength = Number(endStr);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "unsatisfiable";
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? size - 1 : Number(endStr);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return "unsatisfiable";
  }
  return { start, end: Math.min(end, size - 1) };
}
