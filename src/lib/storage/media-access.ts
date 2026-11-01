// Pure rules for children's private media (no "server-only", so every
// branch is unit-testable). The storage layout is fixed by the upload
// actions:
//   recognitions/<schoolId>/<childId>/<timestamp>.<ext>   (Эко Зертхана)
//   media/<schoolId>/<childId>/<timestamp>.<ext>          (Студия)
// Everything else under /uploads (site-media/ — news, banners, logos)
// is public CMS content and stays public.

import type { Role } from "@/lib/auth/roles";

export const PRIVATE_MEDIA_PREFIXES = ["recognitions", "media"] as const;
export type PrivateMediaKind = (typeof PRIVATE_MEDIA_PREFIXES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_RE = /^\d{1,16}\.(jpg|jpeg|png|webp)$/i;

export type PrivateMediaKey = { kind: PrivateMediaKind; schoolId: string; childId: string; key: string };

export type MediaKeyClass =
  | { type: "public" }
  // A private prefix with an unexpected shape: never served to anyone.
  | { type: "invalid" }
  | ({ type: "private" } & PrivateMediaKey);

/** Decodes and normalises URL segments the same way the file server
 * will, so "%72ecognitions" or "Recognitions" can't slip a private
 * file past the prefix check. */
export function normalizeSegments(segments: string[]): string[] | null {
  try {
    return segments.map((s) => decodeURIComponent(s)).filter((s) => s !== "" && s !== ".");
  } catch {
    return null;
  }
}

export function classifyMediaKey(rawSegments: string[]): MediaKeyClass {
  const segments = normalizeSegments(rawSegments);
  if (!segments || segments.length === 0) return { type: "invalid" };
  const first = segments[0].toLowerCase();
  if (!(PRIVATE_MEDIA_PREFIXES as readonly string[]).includes(first)) return { type: "public" };
  const [, schoolId, childId, file, ...rest] = segments;
  if (
    segments[0] !== first || // exact lowercase prefix only, as written by the upload actions
    rest.length > 0 ||
    !schoolId ||
    !childId ||
    !file ||
    !UUID_RE.test(schoolId) ||
    !UUID_RE.test(childId) ||
    !FILE_RE.test(file)
  ) {
    return { type: "invalid" };
  }
  return {
    type: "private",
    kind: first as PrivateMediaKind,
    schoolId: schoolId.toLowerCase(),
    childId: childId.toLowerCase(),
    key: `${first}/${schoolId}/${childId}/${file}`,
  };
}

/** Whether a request path (e.g. "/uploads/recognitions/…") touches a
 * private prefix — used by proxy.ts to route it to the guarded handler. */
export function isPrivateUploadPath(pathname: string): boolean {
  const match = pathname.match(/^\/uploads\/(.*)$/i);
  if (!match) return false;
  const c = classifyMediaKey(match[1].split("/"));
  return c.type !== "public";
}

export type MediaViewer = { userId: string; role: Role; schoolId: string | null };

/** What the database says about the child the file belongs to, as seen
 * through the viewer's own RLS context (null school = not visible). */
export type ChildMediaFacts = {
  childSchoolId: string | null;
  viewerIsLinkedParent: boolean;
  viewerTeachesChildGroup: boolean;
};

export type MediaDecision = "allow" | "deny" | "unauthenticated";

/**
 * School → group → child → role, in that order:
 *  - no session                         → unauthenticated
 *  - key's school ≠ child's real school → deny (forged path)
 *  - SUPER_ADMIN                        → allow (platform operator)
 *  - viewer from another school         → deny (cross-school)
 *  - CHILD   → only their own files
 *  - PARENT  → only children linked to them (parent_child_links)
 *  - TEACHER → only children in a group linked to them (teacher_groups)
 *  - SCHOOL_ADMIN → any child of their own school
 */
export function decideMediaAccess(
  viewer: MediaViewer | null,
  file: PrivateMediaKey,
  facts: ChildMediaFacts
): MediaDecision {
  if (!viewer) return "unauthenticated";
  if (!facts.childSchoolId || facts.childSchoolId.toLowerCase() !== file.schoolId) return "deny";
  if (viewer.role === "SUPER_ADMIN") return "allow";
  if (!viewer.schoolId || viewer.schoolId.toLowerCase() !== file.schoolId) return "deny";

  switch (viewer.role) {
    case "CHILD":
      return viewer.userId.toLowerCase() === file.childId ? "allow" : "deny";
    case "PARENT":
      return facts.viewerIsLinkedParent ? "allow" : "deny";
    case "TEACHER":
      return facts.viewerTeachesChildGroup ? "allow" : "deny";
    case "SCHOOL_ADMIN":
      return "allow";
    default:
      return "deny";
  }
}

/**
 * Legacy URL migration (read side, no data rewrite): rows saved while
 * STORAGE_DRIVER=r2 hold a direct public bucket URL
 * ("<R2_PUBLIC_URL>/recognitions/…"). Those are rewritten to the
 * guarded app path "/uploads/<key>", which streams from R2 after the
 * access check. Local "/uploads/…" URLs already go through the guard
 * and are returned unchanged, as is every public (non-child) URL.
 */
export function toServedMediaUrl(url: string | null, r2PublicUrl: string | undefined): string | null {
  if (!url) return url;
  const base = r2PublicUrl?.trim().replace(/\/$/, "");
  if (base && url.startsWith(`${base}/`)) {
    const key = url.slice(base.length + 1);
    const c = classifyMediaKey(key.split("/"));
    if (c.type === "private") return `/uploads/${c.key}`;
  }
  return url;
}
