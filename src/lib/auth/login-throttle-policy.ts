// Pure login-throttle policy (no server-only — unit-tested directly).
// The counting itself happens in Postgres (0015_login_throttle.sql);
// this module decides the numbers and where the client IP comes from.

export type ThrottlePolicy = {
  /** Wrong PIN/password attempts per identifier before it is locked. */
  identifierMaxFailures: number;
  /** Wrong attempts per client IP (across all identifiers) before the IP is locked. */
  ipMaxFailures: number;
  windowMinutes: number;
  lockMinutes: number;
  /** Cap for the doubling lock on repeat offenders. */
  maxLockMinutes: number;
};

function bounded(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || raw === undefined || raw.trim() === "") return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Env can tune the policy but never switch it off: every value is
 * clamped to a safe range (e.g. at most 10 tries per identifier). */
export function throttlePolicyFromEnv(env: Record<string, string | undefined>): ThrottlePolicy {
  return {
    identifierMaxFailures: bounded(env.LOGIN_MAX_FAILURES_PER_IDENTIFIER, 5, 3, 10),
    ipMaxFailures: bounded(env.LOGIN_MAX_FAILURES_PER_IP, 20, 10, 100),
    windowMinutes: bounded(env.LOGIN_FAILURE_WINDOW_MINUTES, 15, 5, 60),
    lockMinutes: bounded(env.LOGIN_LOCK_MINUTES, 15, 5, 60),
    maxLockMinutes: bounded(env.LOGIN_MAX_LOCK_MINUTES, 60, 15, 24 * 60),
  };
}

/**
 * Client address behind Coolify's Traefik proxy. Traefik overwrites
 * X-Real-Ip with the address it actually received the connection from,
 * so a client can't spoof it; X-Forwarded-For is only a fallback and
 * then its LAST entry is used (the one the nearest proxy appended) —
 * never the first, which the client controls.
 */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return null;
}

/** Whole minutes until `until`, at least 1 — for the "try again in N minutes" message. */
export function minutesUntil(until: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
}
