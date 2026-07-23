/**
 * Minimal, dependency-light migration runner. Applies every .sql file in
 * src/db/migrations, in filename order, that hasn't been applied yet.
 * Deliberately not Prisma — see docs/ARCHITECTURE.md for why the
 * project uses plain SQL migrations + postgres.js as its one source of
 * truth for schema instead.
 *
 * Connects with DATABASE_URL (the schema-owning admin role), never
 * APP_DATABASE_URL — see src/db/client.ts for why those are separate.
 */
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });
config(); // fall back to .env if present

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    await sql`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const dir = path.join(process.cwd(), "src", "db", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const appliedRows = await sql<{ name: string }[]>`select name from _migrations`;
    const applied = new Set(appliedRows.map((r) => r.name));

    let ranCount = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const contents = readFileSync(path.join(dir, file), "utf8");
      console.log(`→ applying ${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`insert into _migrations (name) values (${file})`;
      });
      ranCount++;
    }

    if (ranCount === 0) {
      console.log("✓ Database already up to date, nothing to apply.");
    } else {
      console.log(`✓ Applied ${ranCount} migration(s).`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
