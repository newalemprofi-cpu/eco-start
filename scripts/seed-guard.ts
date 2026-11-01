import type postgres from "postgres";

/**
 * Hard guards for scripts/seed.ts. The seed starts with
 *   delete from schools where id in (select school_id from users where is_demo)
 * and `schools` cascades to EVERYTHING in that school. If real data
 * ever shares a school with a demo account (scripts/import-private-data.ts
 * reuses the first existing school), one `npm run db:seed` would wipe
 * every real child's records. Two independent layers stop that:
 *
 * 1. assertSeedEnvironment (before connecting): never in production,
 *    never against a non-local database unless the operator types the
 *    exact database name into SEED_ALLOW_REMOTE_DATABASE.
 * 2. assertDemoSchoolsAreDemoOnly (inside the seed's transaction,
 *    before the delete): abort if any school about to be deleted
 *    contains a single non-demo user.
 */

export class SeedRefusedError extends Error {
  constructor(message: string) {
    super(`db:seed тоқтатылды: ${message}`);
    this.name = "SeedRefusedError";
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertSeedEnvironment(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV === "production") {
    throw new SeedRefusedError("NODE_ENV=production. Seed production ортада ешқашан іске қосылмайды.");
  }
  const raw = env.DATABASE_URL;
  if (!raw) throw new SeedRefusedError("DATABASE_URL орнатылмаған.");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SeedRefusedError("DATABASE_URL дұрыс URL емес.");
  }
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (LOCAL_HOSTS.has(url.hostname)) return;

  const allowed = env.SEED_ALLOW_REMOTE_DATABASE?.trim();
  if (!allowed || allowed !== dbName) {
    throw new SeedRefusedError(
      `DATABASE_URL жергілікті емес (host: ${url.hostname}). Әдейі қажет болса, SEED_ALLOW_REMOTE_DATABASE айнымалысына дерекқор атауын дәл жазыңыз.`
    );
  }
}

export async function assertDemoSchoolsAreDemoOnly(sql: postgres.Sql | postgres.TransactionSql): Promise<void> {
  const rows = await sql<{ schoolId: string; realUsers: number }[]>`
    select u.school_id as "schoolId", count(*)::int as "realUsers"
    from users u
    where u.school_id in (select school_id from users where is_demo = true)
      and u.is_demo = false
    group by u.school_id
  `;
  if (rows.length > 0) {
    const total = rows.reduce((n, r) => n + r.realUsers, 0);
    throw new SeedRefusedError(
      `демо мекемеде ${total} нақты (is_demo = false) пайдаланушы бар. Seed бұл мекемені толық өшіретін еді — ештеңе өзгертілмеді.`
    );
  }
}
