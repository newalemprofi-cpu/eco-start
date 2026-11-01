import { describe, expect, it } from "vitest";
import {
  classifyMediaKey,
  decideMediaAccess,
  isPrivateUploadPath,
  toServedMediaUrl,
  type ChildMediaFacts,
  type MediaViewer,
  type PrivateMediaKey,
} from "@/lib/storage/media-access";

const SCHOOL = "11111111-1111-4111-8111-111111111111";
const OTHER_SCHOOL = "22222222-2222-4222-8222-222222222222";
const CHILD = "33333333-3333-4333-8333-333333333333";
const OTHER_CHILD = "44444444-4444-4444-8444-444444444444";

const file = classifyMediaKey(["recognitions", SCHOOL, CHILD, "1700000000000.jpg"]) as { type: "private" } & PrivateMediaKey;
const facts = (over: Partial<ChildMediaFacts> = {}): ChildMediaFacts => ({
  childSchoolId: SCHOOL,
  viewerIsLinkedParent: false,
  viewerTeachesChildGroup: false,
  ...over,
});
const viewer = (role: MediaViewer["role"], userId = "55555555-5555-4555-8555-555555555555", schoolId: string | null = SCHOOL): MediaViewer => ({
  role,
  userId,
  schoolId,
});

describe("classifyMediaKey", () => {
  it("recognises both private layouts", () => {
    expect(file.type).toBe("private");
    expect(file.childId).toBe(CHILD);
    expect(classifyMediaKey(["media", SCHOOL, CHILD, "1.png"]).type).toBe("private");
  });

  it("keeps CMS content public", () => {
    expect(classifyMediaKey(["site-media", "news", "x.jpg"]).type).toBe("public");
  });

  it("treats encoded, re-cased or malformed private paths as invalid, never public", () => {
    expect(classifyMediaKey(["%72ecognitions", SCHOOL, CHILD, "1.jpg"]).type).toBe("private");
    expect(classifyMediaKey(["Recognitions", SCHOOL, CHILD, "1.jpg"]).type).toBe("invalid");
    expect(classifyMediaKey(["recognitions", "not-a-uuid", CHILD, "1.jpg"]).type).toBe("invalid");
    expect(classifyMediaKey(["recognitions", SCHOOL, CHILD, "x.svg"]).type).toBe("invalid");
    expect(classifyMediaKey(["recognitions", SCHOOL, CHILD, "1.jpg", "extra"]).type).toBe("invalid");
    expect(classifyMediaKey(["recognitions"]).type).toBe("invalid");
    expect(classifyMediaKey(["%E0%A4%A"]).type).toBe("invalid");
  });

  it("flags every private-looking request path for the guarded handler", () => {
    expect(isPrivateUploadPath(`/uploads/recognitions/${SCHOOL}/${CHILD}/1.jpg`)).toBe(true);
    expect(isPrivateUploadPath(`/uploads/MEDIA/${SCHOOL}/${CHILD}/1.jpg`)).toBe(true);
    expect(isPrivateUploadPath("/uploads/site-media/news/a.jpg")).toBe(false);
  });
});

describe("decideMediaAccess (school → group → child → role)", () => {
  it("requires a session", () => {
    expect(decideMediaAccess(null, file, facts())).toBe("unauthenticated");
  });

  it("child: own files only", () => {
    expect(decideMediaAccess(viewer("CHILD", CHILD), file, facts())).toBe("allow");
    expect(decideMediaAccess(viewer("CHILD", OTHER_CHILD), file, facts())).toBe("deny");
  });

  it("parent: only when linked to that child", () => {
    expect(decideMediaAccess(viewer("PARENT"), file, facts({ viewerIsLinkedParent: true }))).toBe("allow");
    expect(decideMediaAccess(viewer("PARENT"), file, facts())).toBe("deny");
  });

  it("teacher: only for a child in one of their groups", () => {
    expect(decideMediaAccess(viewer("TEACHER"), file, facts({ viewerTeachesChildGroup: true }))).toBe("allow");
    expect(decideMediaAccess(viewer("TEACHER"), file, facts())).toBe("deny");
  });

  it("school admin: own school only; super admin: any", () => {
    expect(decideMediaAccess(viewer("SCHOOL_ADMIN"), file, facts())).toBe("allow");
    expect(decideMediaAccess(viewer("SCHOOL_ADMIN", undefined, OTHER_SCHOOL), file, facts())).toBe("deny");
    expect(decideMediaAccess(viewer("SUPER_ADMIN", undefined, OTHER_SCHOOL), file, facts())).toBe("allow");
  });

  it("denies cross-school viewers even with a link/teacher flag", () => {
    const v = viewer("TEACHER", undefined, OTHER_SCHOOL);
    expect(decideMediaAccess(v, file, facts({ viewerTeachesChildGroup: true }))).toBe("deny");
  });

  it("denies a forged path whose school doesn't match the child's real school", () => {
    expect(decideMediaAccess(viewer("CHILD", CHILD), file, facts({ childSchoolId: OTHER_SCHOOL }))).toBe("deny");
    // Child not visible at all (RLS hid it) → deny, even for super admin.
    expect(decideMediaAccess(viewer("SUPER_ADMIN"), file, facts({ childSchoolId: null }))).toBe("deny");
  });
});

describe("toServedMediaUrl (legacy URL migration)", () => {
  const R2 = "https://pub-x.r2.dev";
  it("moves legacy public R2 child-media URLs behind the guarded path", () => {
    expect(toServedMediaUrl(`${R2}/recognitions/${SCHOOL}/${CHILD}/1.jpg`, R2)).toBe(
      `/uploads/recognitions/${SCHOOL}/${CHILD}/1.jpg`
    );
    expect(toServedMediaUrl(`${R2}/media/${SCHOOL}/${CHILD}/2.png`, `${R2}/`)).toBe(
      `/uploads/media/${SCHOOL}/${CHILD}/2.png`
    );
  });

  it("leaves local paths, public CMS URLs and empty values unchanged", () => {
    const local = `/uploads/recognitions/${SCHOOL}/${CHILD}/1.jpg`;
    expect(toServedMediaUrl(local, R2)).toBe(local);
    expect(toServedMediaUrl(`${R2}/site-media/news/a.jpg`, R2)).toBe(`${R2}/site-media/news/a.jpg`);
    expect(toServedMediaUrl(null, R2)).toBeNull();
    expect(toServedMediaUrl(`${R2}/recognitions/x`, undefined)).toBe(`${R2}/recognitions/x`);
  });
});
