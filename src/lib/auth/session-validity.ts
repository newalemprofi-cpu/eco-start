/**
 * Pure rule (no server-only, unit-testable) for whether a signed JWT
 * session still stands against the user's *current* database row. The
 * JWT alone is stateless for 7 days; this is what makes archiving a
 * user or resetting their password take effect immediately.
 */
import type { Role } from "@/lib/auth/roles";

export type SessionUserState = {
  role: Role;
  schoolId: string;
  archivedAt: string | null;
  /** Epoch seconds of the last revocation (password reset, archive), or null. */
  sessionsRevokedAt: number | null;
};

export function isSessionStillValid(
  session: { role: Role; schoolId: string; iat?: number },
  user: SessionUserState | null
): boolean {
  if (!user) return false; // deleted, or no longer visible to itself
  if (user.archivedAt) return false;
  if (user.role !== session.role || user.schoolId !== session.schoolId) return false;
  if (user.sessionsRevokedAt != null) {
    // iat has 1-second precision: a token issued in the same second as
    // the revocation is treated as revoked (re-login is cheap; a stale
    // session surviving a password reset is not).
    if (typeof session.iat !== "number") return false;
    const revokedAtSec = Math.floor(user.sessionsRevokedAt);
    if (session.iat <= revokedAtSec) return false;
  }
  return true;
}
