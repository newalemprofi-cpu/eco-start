import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "@/test/fixtures";
import { checkChildMediaAccess } from "@/db/repo/media-access";
import { classifyMediaKey, type PrivateMediaKey } from "@/lib/storage/media-access";
import type { TenantContext } from "@/db/client";
import { pool } from "@/db/client";

// Authorization for children's photos, against the real database as
// app_user (RLS on). Covers same-school/other-group, IDOR on another
// child's id, forged school ids and a second school (cross-school).

let f: Fixture;
let parentA: TenantContext; // linked to childA by the seed
let unlinkedParent: TenantContext;
let adminA: TenantContext;
let superAdmin: TenantContext;
let schoolB: string;
let adminB: TenantContext;
let teacherSchoolB: TenantContext;
let childC: TenantContext; // child in school B

function key(kind: "recognitions" | "media", schoolId: string, childId: string): PrivateMediaKey {
  const c = classifyMediaKey([kind, schoolId, childId, "1700000000000.jpg"]);
  if (c.type !== "private") throw new Error("bad key");
  return c;
}

beforeAll(async () => {
  f = await createFixture();
  const o = f.owner;
  const id = async (where: string) => (await o.unsafe<{ id: string }[]>(`select id from users where ${where}`))[0].id;

  parentA = { userId: await id("email = 'parent@ecostart.local'"), schoolId: f.schoolId, role: "PARENT" };
  adminA = { userId: await id("email = 'admin@ecostart.local'"), schoolId: f.schoolId, role: "SCHOOL_ADMIN" };
  superAdmin = { userId: await id("email = 'superadmin@ecostart.local'"), schoolId: f.schoolId, role: "SUPER_ADMIN" };

  const suffix = Math.random().toString(36).slice(2, 8);
  const [p] = await o<{ id: string }[]>`
    insert into users (school_id, role, email, password_hash, display_name, is_demo)
    values (${f.schoolId}, 'PARENT', ${`int-parent-${suffix}@test.local`}, 'x', 'Байланыссыз ата-ана', true) returning id
  `;
  unlinkedParent = { userId: p.id, schoolId: f.schoolId, role: "PARENT" };

  const [s] = await o<{ id: string }[]>`insert into schools (name) values (${`Int school B ${suffix}`}) returning id`;
  schoolB = s.id;
  const [g] = await o<{ id: string }[]>`
    insert into groups (school_id, name, code) values (${schoolB}, 'B тобы', ${`B-${suffix}`}) returning id
  `;
  const [a] = await o<{ id: string }[]>`
    insert into users (school_id, role, email, password_hash, display_name, is_demo)
    values (${schoolB}, 'SCHOOL_ADMIN', ${`int-adminb-${suffix}@test.local`}, 'x', 'Admin B', true) returning id
  `;
  const [t] = await o<{ id: string }[]>`
    insert into users (school_id, role, email, password_hash, display_name, is_demo)
    values (${schoolB}, 'TEACHER', ${`int-teacherb-${suffix}@test.local`}, 'x', 'Teacher B', true) returning id
  `;
  await o`insert into teacher_groups (teacher_id, group_id) values (${t.id}, ${g.id})`;
  const [c] = await o<{ id: string }[]>`
    insert into users (school_id, role, login_code, pin_hash, display_name, group_id, is_demo)
    values (${schoolB}, 'CHILD', ${`int-childc-${suffix}`}, 'x', 'Child C', ${g.id}, true) returning id
  `;
  adminB = { userId: a.id, schoolId: schoolB, role: "SCHOOL_ADMIN" };
  teacherSchoolB = { userId: t.id, schoolId: schoolB, role: "TEACHER" };
  childC = { userId: c.id, schoolId: schoolB, role: "CHILD" };
});

afterAll(async () => {
  await f.owner.end();
  await pool.end();
});

describe("children's media authorization (school → group → child → role)", () => {
  it("no session → unauthenticated", async () => {
    expect(await checkChildMediaAccess(null, key("recognitions", f.schoolId, f.childA.userId))).toBe("unauthenticated");
  });

  it("the child sees their own photo, not a classmate's (IDOR)", async () => {
    const own = key("recognitions", f.schoolId, f.childA.userId);
    expect(await checkChildMediaAccess(f.childA, own)).toBe("allow");
    expect(await checkChildMediaAccess(f.childA2, own)).toBe("deny");
    expect(await checkChildMediaAccess(f.childB, key("media", f.schoolId, f.childA.userId))).toBe("deny");
  });

  it("teacher: own group yes, another group of the same school no", async () => {
    const file = key("recognitions", f.schoolId, f.childA.userId);
    expect(await checkChildMediaAccess(f.teacherA, file)).toBe("allow");
    expect(await checkChildMediaAccess(f.teacherB, file)).toBe("deny");
    expect(await checkChildMediaAccess(f.teacherB, key("recognitions", f.schoolId, f.childB.userId))).toBe("allow");
  });

  it("parent: linked child yes, any other child no", async () => {
    expect(await checkChildMediaAccess(parentA, key("media", f.schoolId, f.childA.userId))).toBe("allow");
    expect(await checkChildMediaAccess(parentA, key("media", f.schoolId, f.childB.userId))).toBe("deny");
    expect(await checkChildMediaAccess(unlinkedParent, key("media", f.schoolId, f.childA.userId))).toBe("deny");
  });

  it("school admin: own school only; super admin: any school", async () => {
    const fileA = key("recognitions", f.schoolId, f.childA.userId);
    const fileC = key("recognitions", schoolB, childC.userId);
    expect(await checkChildMediaAccess(adminA, fileA)).toBe("allow");
    expect(await checkChildMediaAccess(adminA, fileC)).toBe("deny");
    expect(await checkChildMediaAccess(adminB, fileA)).toBe("deny");
    expect(await checkChildMediaAccess(superAdmin, fileC)).toBe("allow");
  });

  it("cross-school: no role of school B reaches school A's children", async () => {
    const fileA = key("recognitions", f.schoolId, f.childA.userId);
    expect(await checkChildMediaAccess(teacherSchoolB, fileA)).toBe("deny");
    expect(await checkChildMediaAccess(childC, fileA)).toBe("deny");
  });

  it("forged path: right child id under another school's id is refused, even for the owner", async () => {
    expect(await checkChildMediaAccess(f.childA, key("recognitions", schoolB, f.childA.userId))).toBe("deny");
    expect(await checkChildMediaAccess(adminB, key("recognitions", schoolB, f.childA.userId))).toBe("deny");
  });

  it("RLS: school B's admin can't even read school A's child row", async () => {
    const { withTenantContext } = await import("@/db/client");
    const rows = await withTenantContext(adminB, (sql) => sql`select id from users where id = ${f.childA.userId}`);
    expect(rows).toHaveLength(0);
  });
});
