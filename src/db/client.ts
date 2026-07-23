import "server-only";
import postgres from "postgres";

/**
 * Runtime database pool for the Next.js app. Connects as `app_user`
 * (see src/db/migrations/0003_app_role_and_extra_policies.sql), a role
 * with no special Postgres privileges, so that Row Level Security
 * (0002_rls.sql) is the real, enforced last line of defense — not just
 * documentation. The app-layer authorization in src/lib/auth/dal.ts is
 * the primary check; this is the belt under those braces.
 */
declare global {
  var __ecoStartDbPool: postgres.Sql | undefined;
}

function createPool() {
  const connectionString = process.env.APP_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "APP_DATABASE_URL is not set. Copy .env.example to .env.local and start the database (see README.md)."
    );
  }
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: { undefined: null },
    types: {
      // Return date/timestamp columns as raw ISO strings instead of JS
      // Date objects — every repo function types these as `string`,
      // and raw strings serialize into Server Component payloads and
      // JSON responses without extra conversion at every call site.
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      timestamp: { to: 1114, from: [1114], serialize: (x: string) => x, parse: (x: string) => x },
      timestamptz: { to: 1184, from: [1184], serialize: (x: string) => x, parse: (x: string) => x },
      // Postgres `numeric` columns (heights, confidences, measurements)
      // come back as strings by default to avoid float precision loss
      // on values Postgres can't guarantee round-trip as a JS double.
      // Nothing in this app needs that guarantee, and repo types
      // declare these fields `number`, so parse them eagerly here
      // instead of at every call site.
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });
}

// Reused across hot reloads in dev so we don't exhaust connections.
export const pool = globalThis.__ecoStartDbPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__ecoStartDbPool = pool;
}

export type TenantContext = {
  userId: string;
  schoolId: string | null;
  role: "CHILD" | "PARENT" | "TEACHER" | "SCHOOL_ADMIN" | "SUPER_ADMIN";
};

/**
 * Runs `fn` inside a transaction with the three session GUCs Postgres
 * RLS policies check (app.current_user_id / app.current_school_id /
 * app.current_role) set for the lifetime of that transaction only
 * (`set_config(..., true)` = transaction-local, never leaks across
 * pooled connections).
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (sql: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  const result = await pool.begin(async (sql) => {
    await sql`select set_config('app.current_user_id', ${ctx.userId}, true)`;
    await sql`select set_config('app.current_school_id', ${ctx.schoolId ?? ""}, true)`;
    await sql`select set_config('app.current_role', ${ctx.role}, true)`;
    return fn(sql);
  });
  return result as T;
}

/**
 * For system-level operations that have no authenticated user (e.g. the
 * login lookup itself, before a session exists). Runs with no tenant
 * GUCs set, which means RLS policies will treat the caller as
 * unauthenticated for every table except the ones explicitly designed
 * to allow it (there are none — login goes through a dedicated,
 * narrowly-scoped query, see src/lib/auth/credentials.ts).
 */
export async function withSystemContext<T>(
  fn: (sql: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  const result = await pool.begin(async (sql) => fn(sql));
  return result as T;
}
