import path from "node:path";

// Pure path-traversal check — deliberately has no "server-only" import
// (unlike src/lib/storage/upload-root.ts, which resolves the actual
// root from the environment), so it can be unit-tested directly with
// vitest. See src/app/uploads/[...path]/route.ts, the one caller.

/**
 * Resolves `segments` against `root` and verifies the result is still
 * inside it — rejects ".." segments outright (belt), then re-checks
 * after path.resolve() (suspenders: catches encoded/combined
 * traversal attempts a naive segment check could miss).
 */
export function resolveSafePath(root: string, segments: string[]): string | null {
  if (segments.some((s) => s === ".." || s.includes("..") || s.includes("\0"))) return null;

  const resolvedRoot = path.resolve(root);
  const requested = path.resolve(resolvedRoot, ...segments);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;

  if (requested !== resolvedRoot && !requested.startsWith(rootWithSep)) return null;
  return requested;
}
