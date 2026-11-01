import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { assertDemoSchoolsAreDemoOnly, SeedRefusedError } from "./seed-guard";

// The data-level seed guard against the isolated test DB: a demo school
// that also holds a real (is_demo = false) user must never be wiped.

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });

afterAll(async () => {
  await sql.end();
});

describe("assertDemoSchoolsAreDemoOnly", () => {
  it("refuses — and the delete is rolled back — once a real user shares the demo school", async () => {
    const [{ schoolId }] = await sql<{ schoolId: string }[]>`
      select school_id as "schoolId" from users where email = 'teacher@ecostart.local'
    `;
    const before = await sql<{ n: number }[]>`select count(*)::int as n from users where school_id = ${schoolId}`;

    await sql.begin(async (tx) => {
      await tx`
        insert into users (school_id, role, login_code, pin_hash, display_name, is_demo)
        values (${schoolId}, 'CHILD', ${`real-${Date.now()}`}, 'x', 'Нақты бала', false)
      `;
      // Same shape as scripts/seed.ts: guard, then delete, in one transaction.
      await expect(
        (async () => {
          await assertDemoSchoolsAreDemoOnly(tx);
          await tx`delete from schools where id in (select school_id from users where is_demo = true)`;
        })()
      ).rejects.toBeInstanceOf(SeedRefusedError);
      throw new Error("rollback test insert");
    }).catch((e: Error) => {
      if (e.message !== "rollback test insert") throw e;
    });

    const after = await sql<{ n: number }[]>`select count(*)::int as n from users where school_id = ${schoolId}`;
    expect(after[0].n).toBe(before[0].n);
  });
});
