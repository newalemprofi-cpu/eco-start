import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { decrypt, readSessionCookie, type Role, type SessionPayload } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/roles";
import type { TenantContext } from "@/db/client";
import { getSessionUserState } from "@/db/repo/session-state";
import { isSessionStillValid } from "@/lib/auth/session-validity";

export { roleHome } from "@/lib/auth/roles";

/** Clears the session cookie, then lands on /login (see route.ts there). */
export const SESSION_ENDED_PATH = "/api/auth/session-ended";

/**
 * The Data Access Layer entry point every server component, server
 * action, and route handler in an authenticated area calls first. This
 * — not the UI, not proxy.ts — is the real authorization boundary.
 * proxy.ts only does optimistic, cookie-only redirects for UX; see
 * docs/ARCHITECTURE.md "Authorization: two layers, one source of truth".
 */
export const verifySession = cache(async (): Promise<SessionPayload> => {
  const cookie = await readSessionCookie();
  const session = await decrypt(cookie);
  if (!session) {
    redirect("/login");
  }
  if (!(await isStillValid(session))) {
    // Archived user or revoked session (password reset): the cookie must
    // be cleared, or proxy.ts (cookie-only) would bounce /login straight
    // back here forever. Server components can't touch cookies, so a
    // tiny route handler does it.
    redirect(SESSION_ENDED_PATH);
  }
  return session;
});

/** Like verifySession, but returns null instead of redirecting. */
export const getOptionalSession = cache(async (): Promise<SessionPayload | null> => {
  const cookie = await readSessionCookie();
  const session = await decrypt(cookie);
  if (!session) return null;
  return (await isStillValid(session)) ? session : null;
});

/** The JWT is stateless; the database row is the truth about whether
 * the account is still active and the session not revoked. One cached
 * primary-key lookup per request. */
const isStillValid = cache(async (session: SessionPayload): Promise<boolean> => {
  const state = await getSessionUserState(toTenantContext(session));
  return isSessionStillValid(session, state);
});

/**
 * Verifies the session AND that its role is one of `roles`. Redirects
 * unauthenticated users to /login and authenticated-but-unauthorized
 * users to their own dashboard rather than exposing a 404/500.
 */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await verifySession();
  if (!roles.includes(session.role)) {
    redirect(roleHome(session.role));
  }
  return session;
}

export function toTenantContext(session: SessionPayload): TenantContext {
  return { userId: session.userId, schoolId: session.schoolId, role: session.role };
}
