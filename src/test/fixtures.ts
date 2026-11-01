import postgres from "postgres";
import type { TenantContext } from "@/db/client";

/**
 * Builds a two-group scenario on top of the seeded demo school (owner
 * connection, test DB only — see integration-setup.ts):
 *   teacherA — seeded teacher@ecostart.local, group KUN-01, childA in it
 *   teacherB — new teacher, group ORTA-01 (3–4 жас), childB in it
 * so every test can check both "own group works" and "other group is
 * refused". Unique suffixes keep reruns on the same DB independent.
 */
export type Fixture = {
  owner: postgres.Sql;
  schoolId: string;
  groupA: string;
  groupB: string;
  teacherA: TenantContext;
  teacherB: TenantContext;
  childA: TenantContext;
  childA2: TenantContext;
  childB: TenantContext;
};

export async function createFixture(): Promise<Fixture> {
  const owner = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
  const suffix = Math.random().toString(36).slice(2, 8);

  const [teacher] = await owner<{ id: string; schoolId: string; groupId: string }[]>`
    select u.id, u.school_id as "schoolId", tg.group_id as "groupId"
    from users u join teacher_groups tg on tg.teacher_id = u.id
    where u.email = 'teacher@ecostart.local'
  `;
  if (!teacher) throw new Error("Seeded teacher not found — run `npm run db:seed` against the test DB first.");
  const [groupB] = await owner<{ id: string }[]>`select id from groups where code = 'ORTA-01'`;
  const [childA] = await owner<{ id: string }[]>`select id from users where login_code = 'child@ecostart.local'`;
  const [childA2] = await owner<{ id: string }[]>`select id from users where login_code = 'demo-child-2'`;

  const [teacherB] = await owner<{ id: string }[]>`
    insert into users (school_id, role, email, password_hash, display_name, is_demo)
    values (${teacher.schoolId}, 'TEACHER', ${`int-teacher-${suffix}@test.local`}, 'x', 'Тест тәрбиеші B', true)
    returning id
  `;
  await owner`insert into teacher_groups (teacher_id, group_id) values (${teacherB.id}, ${groupB.id})`;
  const [childB] = await owner<{ id: string }[]>`
    insert into users (school_id, role, login_code, pin_hash, display_name, group_id, is_demo)
    values (${teacher.schoolId}, 'CHILD', ${`int-child-${suffix}`}, 'x', 'Тест бала B', ${groupB.id}, true)
    returning id
  `;

  const ctx = (userId: string, role: TenantContext["role"]): TenantContext => ({
    userId,
    schoolId: teacher.schoolId,
    role,
  });

  return {
    owner,
    schoolId: teacher.schoolId,
    groupA: teacher.groupId,
    groupB: groupB.id,
    teacherA: ctx(teacher.id, "TEACHER"),
    teacherB: ctx(teacherB.id, "TEACHER"),
    childA: ctx(childA.id, "CHILD"),
    childA2: ctx(childA2.id, "CHILD"),
    childB: ctx(childB.id, "CHILD"),
  };
}
