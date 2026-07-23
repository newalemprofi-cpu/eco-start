import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { decrypt, readSessionCookie, type Role, type SessionPayload } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/roles";
import type { TenantContext } from "@/db/client";

export { roleHome } from "@/lib/auth/roles";

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
  return session;
});

/** Like verifySession, but returns null instead of redirecting. */
export const getOptionalSession = cache(async (): Promise<SessionPayload | null> => {
  const cookie = await readSessionCookie();
  return decrypt(cookie);
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
