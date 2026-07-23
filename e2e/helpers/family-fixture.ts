import { config } from "dotenv";
import postgres from "postgres";
import { readImportCredentials, getFirstTeacherCredential, type ImportedCredential } from "./import-credentials";

/**
 * Resolves one real, linked (teacher → their group → a child in that
 * group → that child's parent) family from the live database, purely
 * from IDs/emails/login codes — never by hardcoding any imported
 * person's name in source. Real children's/parents' full names are
 * PII (item 16) and must not end up committed in git history, unlike
 * the git-ignored private-data/import-credentials.csv this reads
 * secrets from.
 *
 * Used by specs that need a cross-role scenario (e.g. "a teacher sees
 * their own group's roster", "a parent sees only their own child")
 * against the real imported roster instead of the deleted demo
 * accounts.
 */

config({ path: ".env.local" });
config();

export type FamilyFixture = {
  teacher: ImportedCredential;
  child: ImportedCredential;
  parent: ImportedCredential;
  groupCode: string;
  groupName: string;
  ageCategory: string;
};

let cached: Promise<FamilyFixture> | null = null;

export function getFamilyFixture(): Promise<FamilyFixture> {
  if (!cached) cached = loadFamilyFixture();
  return cached;
}

async function loadFamilyFixture(): Promise<FamilyFixture> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set — copy .env.example to .env.local first.");

  const teacher = getFirstTeacherCredential();
  const credentials = readImportCredentials();

  const sql = postgres(connectionString, { max: 1 });
  try {
    const [group] = await sql<{ code: string; name: string; ageCategory: string }[]>`
      select g.code, g.name, g.age_category as "ageCategory"
      from groups g
      join users t on t.id = g.educator_id
      where t.email = ${teacher.loginIdentifier}
      limit 1
    `;
    if (!group) throw new Error(`"${teacher.loginIdentifier}" мұғалімінің тобы табылмады.`);

    const [child] = await sql<{ loginCode: string }[]>`
      select login_code as "loginCode" from users
      where role = 'CHILD' and group_id = (select id from groups where code = ${group.code})
      order by login_code
      limit 1
    `;
    if (!child) throw new Error(`"${group.code}" тобында бала табылмады.`);

    const [parent] = await sql<{ email: string }[]>`
      select p.email from users c
      join parent_child_links pcl on pcl.child_id = c.id
      join users p on p.id = pcl.parent_id
      where c.login_code = ${child.loginCode}
      limit 1
    `;
    if (!parent) throw new Error(`"${child.loginCode}" баласының ата-анасы табылмады.`);

    const childCredential = credentials.find((c) => c.role === "CHILD" && c.loginIdentifier === child.loginCode);
    const parentCredential = credentials.find((c) => c.role === "PARENT" && c.loginIdentifier === parent.email);
    if (!childCredential || !parentCredential) {
      throw new Error("private-data/import-credentials.csv ішінде сәйкес жазба табылмады.");
    }

    return {
      teacher,
      child: childCredential,
      parent: parentCredential,
      groupCode: group.code,
      groupName: group.name,
      ageCategory: group.ageCategory,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
