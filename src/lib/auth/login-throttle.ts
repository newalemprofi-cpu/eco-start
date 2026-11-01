import "server-only";
import { withSystemContext } from "@/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { throttlePolicyFromEnv } from "@/lib/auth/login-throttle-policy";

/**
 * Persistent brute-force throttle around login (0015 migration). All
 * state lives in Postgres behind security-definer functions, so it
 * survives restarts/redeploys and is shared by every app instance.
 *
 * If those functions are unavailable (migration not applied yet, DB
 * hiccup) it falls back to the old in-memory limiter rather than either
 * blocking every login or allowing unlimited guessing.
 */
const policy = throttlePolicyFromEnv(process.env);

function fallbackKey(identifier: string) {
  return `login:${identifier.toLowerCase()}`;
}

/** Returns the time until which login is blocked, or null if allowed. */
export async function getLoginLock(identifier: string, ip: string | null): Promise<Date | null> {
  try {
    const [row] = await withSystemContext(
      (sql) => sql<{ until: string | null }[]>`select auth_throttle_status(${identifier}, ${ip}) as until`
    );
    return row?.until ? new Date(row.until) : null;
  } catch (err) {
    console.error("login throttle unavailable, using in-memory fallback", (err as Error).message);
    const { allowed, retryAfterMs } = rateLimit(
      fallbackKey(identifier),
      policy.identifierMaxFailures,
      policy.windowMinutes * 60_000
    );
    return allowed ? null : new Date(Date.now() + retryAfterMs);
  }
}

/** Records a failed attempt; returns the lock time if this attempt triggered/extended a lock. */
export async function recordLoginFailure(identifier: string, ip: string | null): Promise<Date | null> {
  try {
    const [row] = await withSystemContext(
      (sql) => sql<{ until: string | null }[]>`
        select auth_throttle_fail(
          ${identifier}, ${ip},
          ${policy.identifierMaxFailures}, ${policy.ipMaxFailures},
          ${policy.windowMinutes}, ${policy.lockMinutes}, ${policy.maxLockMinutes}
        ) as until
      `
    );
    return row?.until ? new Date(row.until) : null;
  } catch (err) {
    console.error("login throttle unavailable (record failure)", (err as Error).message);
    return null;
  }
}

export async function recordLoginSuccess(identifier: string): Promise<void> {
  try {
    await withSystemContext((sql) => sql`select auth_throttle_success(${identifier})`);
  } catch (err) {
    console.error("login throttle unavailable (record success)", (err as Error).message);
  }
}
