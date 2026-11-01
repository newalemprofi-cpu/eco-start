import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "@/test/fixtures";
import {
  archiveUser,
  linkParentToChild,
  listManagedChildren,
  listManagedTeachers,
  moveChildToGroup,
  resetPassword,
  restoreUser,
  unlinkParentFromChild,
  updateChild,
  updateTeacher,
  UserAdminError,
} from "@/db/repo/user-admin";
import { resolveChildGroup } from "@/db/repo/admin";
import { getSessionUserState } from "@/db/repo/session-state";
import { canAccessChildData } from "@/db/repo/access";
import { checkChildMediaAccess } from "@/db/repo/media-access";
import { getRoster } from "@/db/repo/teacher";
import { authenticate } from "@/lib/auth/credentials";
import { hashSecret } from "@/lib/auth/hash";
import { isSessionStillValid } from "@/lib/auth/session-validity";
import { classifyMediaKey, type PrivateMediaKey } from "@/lib/storage/media-access";
import { pool, type TenantContext } from "@/db/client";

// Release 2 user management against the real DB as app_user (RLS on):
// role/slot change, archive → no login + session revoked, restore,
// cross-school and admin-account protection, parent unlink cuts access.

let f: Fixture;
let admin: TenantContext;
let superAdmin: TenantContext;
let parent: TenantContext;
let adminB: TenantContext;
let schoolBChild: string;
const PIN = "4826";
const suffix = Math.random().toString(36).slice(2, 8);

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof UserAdminError && e.code === code);
}

beforeAll(async () => {
  f = await createFixture();
  const o = f.owner;
  const id = async (email: string) => (await o<{ id: string }[]>`select id from users where email = ${email}`)[0].id;
  admin = { userId: await id("admin@ecostart.local"), schoolId: f.schoolId, role: "SCHOOL_ADMIN" };
  superAdmin = { userId: await id("superadmin@ecostart.local"), schoolId: f.schoolId, role: "SUPER_ADMIN" };
  parent = { userId: await id("parent@ecostart.local"), schoolId: f.schoolId, role: "PARENT" };

  // The seed links teachers only via teacher_groups; give KUN-01 a real
  // educator slot holder so the "slot taken" path is exercised.
  await o`update groups set educator_id = ${f.teacherA.userId} where id = ${f.groupA}`;

  // A real PIN on childB so login can be exercised.
  await o`update users set pin_hash = ${await hashSecret(PIN)} where id = ${f.childB.userId}`;

  const [s] = await o<{ id: string }[]>`insert into schools (name) values (${`Int school B ${suffix}`}) returning id`;
  const [a] = await o<{ id: string }[]>`
    insert into users (school_id, role, email, password_hash, display_name, is_demo)
    values (${s.id}, 'SCHOOL_ADMIN', ${`int-adminb2-${suffix}@test.local`}, 'x', 'Admin B', true) returning id
  `;
  const [c] = await o<{ id: string }[]>`
    insert into users (school_id, role, login_code, pin_hash, display_name, is_demo)
    values (${s.id}, 'CHILD', ${`int-cb-${suffix}`}, 'x', 'Child B-school', true) returning id
  `;
  adminB = { userId: a.id, schoolId: s.id, role: "SCHOOL_ADMIN" };
  schoolBChild = c.id;
});

afterAll(async () => {
  await f.owner.end();
  await pool.end();
});

describe("teachers: edit role (Тәрбиеші ↔ Педагог-ассистент) and group", () => {
  it("moves teacherB to group A as assistant; teacher_groups follows", async () => {
    const res = await updateTeacher(admin, f.teacherB.userId, {
      displayName: "Тест тәрбиеші B (өңделді)",
      email: `int-teacher-edited-${suffix}@test.local`,
      position: "assistant",
      groupId: f.groupA,
      replaceExisting: true, // the seed may already have an assistant in KUN-01
    });
    expect(res.after.position).toBe("assistant");

    const [g] = await f.owner<{ assistant: string | null }[]>`select pedagogical_assistant_id as assistant from groups where id = ${f.groupA}`;
    expect(g.assistant).toBe(f.teacherB.userId);
    const links = await f.owner<{ groupId: string }[]>`select group_id as "groupId" from teacher_groups where teacher_id = ${f.teacherB.userId}`;
    expect(links.map((l) => l.groupId)).toEqual([f.groupA]);

    const listed = (await listManagedTeachers(admin, false)).find((t) => t.id === f.teacherB.userId);
    expect(listed?.position).toBe("assistant");
    expect(listed?.groupId).toBe(f.groupA);
  });

  it("switches the same teacher to the main (Тәрбиеші) slot only after explicit confirmation", async () => {
    const input = {
      displayName: "Тест тәрбиеші B",
      email: `int-teacher-edited-${suffix}@test.local`,
      position: "main" as const,
      groupId: f.groupA,
      replaceExisting: false,
    };
    // KUN-01's educator slot belongs to the seeded teacher → refused.
    await expectCode(updateTeacher(admin, f.teacherB.userId, input), "slot_taken");
    // Put it back where it was: assistant of group B.
    await updateTeacher(admin, f.teacherB.userId, { ...input, position: "assistant", groupId: f.groupB, replaceExisting: true });
  });

  it("refuses a duplicate e-mail", async () => {
    await expectCode(
      updateTeacher(admin, f.teacherB.userId, {
        displayName: "x x",
        email: "TEACHER@ecostart.local",
        position: "main",
        groupId: null,
        replaceExisting: false,
      }),
      "email_taken"
    );
  });
});

describe("RBAC: no cross-school edits, no admin accounts as targets", () => {
  it("school B's admin can't edit or archive school A's people", async () => {
    await expectCode(archiveUser(adminB, f.childA.userId, "CHILD"), "not_found");
    await expectCode(moveChildToGroup(adminB, f.childA.userId, f.groupA), "not_found");
    await expectCode(
      updateTeacher(adminB, f.teacherA.userId, { displayName: "Hijack", email: "h@x.io", position: "main", groupId: null, replaceExisting: false }),
      "not_found"
    );
  });

  it("school A's admin can't touch school B's child, nor use a group id that isn't theirs", async () => {
    await expectCode(archiveUser(admin, schoolBChild, "CHILD"), "not_found");
    const [gB] = await f.owner<{ id: string }[]>`
      insert into groups (school_id, name, code) values (${adminB.schoolId}, 'B тобы', ${`B2-${suffix}`}) returning id
    `;
    await expectCode(moveChildToGroup(admin, f.childA.userId, gB.id), "group_not_found");
  });

  it("an administrator account is never a valid target (super admin can't be demoted or locked out)", async () => {
    await expectCode(archiveUser(admin, superAdmin.userId, "TEACHER"), "not_found");
    await expectCode(archiveUser(admin, superAdmin.userId, "PARENT"), "not_found");
    await expectCode(resetPassword(admin, superAdmin.userId, "TEACHER", "x"), "not_found");
    await expectCode(archiveUser(admin, admin.userId, "TEACHER"), "cannot_archive_self");
    const [row] = await f.owner<{ role: string; archived: boolean }[]>`
      select role, archived_at is not null as archived from users where id = ${superAdmin.userId}
    `;
    expect(row).toEqual({ role: "SUPER_ADMIN", archived: false });
  });
});

describe("children: archive → no login, history kept; restore → login again", () => {
  it("archives, blocks login and the live session, keeps XP and game history", async () => {
    const code = (await f.owner<{ code: string }[]>`select login_code as code from users where id = ${f.childB.userId}`)[0].code;
    expect(await authenticate(code, PIN)).not.toBeNull();

    await f.owner`update users set xp = 77 where id = ${f.childB.userId}`;
    const sessionBefore = { role: "CHILD" as const, schoolId: f.schoolId, iat: Math.floor(Date.now() / 1000) - 5 };
    expect(isSessionStillValid(sessionBefore, await getSessionUserState(f.childB))).toBe(true);

    expect((await archiveUser(admin, f.childB.userId, "CHILD")).changed).toBe(true);

    expect(await authenticate(code, PIN)).toBeNull();
    expect(isSessionStillValid(sessionBefore, await getSessionUserState(f.childB))).toBe(false);
    expect((await listManagedChildren(admin, false)).some((c) => c.id === f.childB.userId)).toBe(false);
    expect((await listManagedChildren(admin, true)).some((c) => c.id === f.childB.userId)).toBe(true);
    expect((await getRoster(f.teacherB, f.groupB)).some((c) => c.id === f.childB.userId)).toBe(false);

    const [kept] = await f.owner<{ xp: number }[]>`select xp from users where id = ${f.childB.userId}`;
    expect(kept.xp).toBe(77);
  });

  it("restores the child: active list and login work again", async () => {
    expect((await restoreUser(admin, f.childB.userId, "CHILD")).changed).toBe(true);
    const code = (await f.owner<{ code: string }[]>`select login_code as code from users where id = ${f.childB.userId}`)[0].code;
    expect(await authenticate(code, PIN)).not.toBeNull();
    expect((await listManagedChildren(admin, false)).some((c) => c.id === f.childB.userId)).toBe(true);
  });

  it("edits name / login code / PIN; a PIN reset ends existing sessions", async () => {
    const newCode = `int-renamed-${suffix}`;
    const sessionBefore = { role: "CHILD" as const, schoolId: f.schoolId, iat: Math.floor(Date.now() / 1000) - 5 };
    await updateChild(admin, f.childB.userId, { displayName: "Атауы өзгерді", loginCode: newCode, groupId: f.groupB, pinHash: await hashSecret("9071") });
    expect(await authenticate(newCode, "9071")).not.toBeNull();
    expect(await authenticate(newCode, PIN)).toBeNull();
    expect(isSessionStillValid(sessionBefore, await getSessionUserState(f.childB))).toBe(false);
  });

  it("resolveChildGroup works (users.updated_at now exists)", async () => {
    await f.owner`update users set needs_review = true where id = ${f.childA2.userId}`;
    await resolveChildGroup(admin, f.childA2.userId, f.groupA);
    const [row] = await f.owner<{ needsReview: boolean }[]>`select needs_review as "needsReview" from users where id = ${f.childA2.userId}`;
    expect(row.needsReview).toBe(false);
  });
});

describe("teachers/parents: archive blocks login; password reset revokes sessions", () => {
  it("an archived teacher can't sign in; restored, they can", async () => {
    await f.owner`update users set password_hash = ${await hashSecret("Teacher-B-2026")} where id = ${f.teacherB.userId}`;
    const [{ email }] = await f.owner<{ email: string }[]>`select email from users where id = ${f.teacherB.userId}`;
    expect(await authenticate(email, "Teacher-B-2026")).not.toBeNull();
    await archiveUser(superAdmin, f.teacherB.userId, "TEACHER"); // super admin may manage too
    expect(await authenticate(email, "Teacher-B-2026")).toBeNull();
    await restoreUser(superAdmin, f.teacherB.userId, "TEACHER");
    expect(await authenticate(email, "Teacher-B-2026")).not.toBeNull();
  });

  it("a password reset ends every earlier session of that account", async () => {
    const before = { role: "TEACHER" as const, schoolId: f.schoolId, iat: Math.floor(Date.now() / 1000) - 5 };
    await resetPassword(admin, f.teacherB.userId, "TEACHER", await hashSecret("New-Pass-2026"));
    expect(isSessionStillValid(before, await getSessionUserState(f.teacherB))).toBe(false);
    const after = { ...before, iat: Math.floor(Date.now() / 1000) + 2 };
    expect(isSessionStillValid(after, await getSessionUserState(f.teacherB))).toBe(true);
  });
});

describe("parents: link / unlink controls access to the child's data and photos", () => {
  const photo = (childId: string): PrivateMediaKey => {
    const c = classifyMediaKey(["recognitions", f.schoolId, childId, "1700000000000.jpg"]);
    if (c.type !== "private") throw new Error("bad key");
    return c;
  };

  it("linking grants, unlinking immediately revokes", async () => {
    expect(await canAccessChildData(parent, f.childB.userId)).toBe(false);
    expect(await checkChildMediaAccess(parent, photo(f.childB.userId))).toBe("deny");

    expect((await linkParentToChild(admin, parent.userId, f.childB.userId)).created).toBe(true);
    expect(await canAccessChildData(parent, f.childB.userId)).toBe(true);
    expect(await checkChildMediaAccess(parent, photo(f.childB.userId))).toBe("allow");

    const { removed } = await unlinkParentFromChild(admin, parent.userId, f.childB.userId);
    expect(removed).not.toBeNull();
    expect(await canAccessChildData(parent, f.childB.userId)).toBe(false);
    expect(await checkChildMediaAccess(parent, photo(f.childB.userId))).toBe("deny");
  });

  it("can't link a parent to another school's child", async () => {
    await expectCode(linkParentToChild(admin, parent.userId, schoolBChild), "not_found");
  });
});
