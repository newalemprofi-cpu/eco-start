import "server-only";
import { withSystemContext } from "@/db/client";
import { verifySecret } from "@/lib/auth/hash";
import type { Role } from "@/lib/auth/session";

type CredentialRow = {
  id: string;
  school_id: string;
  role: Role;
  password_hash: string | null;
  pin_hash: string | null;
  display_name: string;
  avatar_url: string | null;
  locale: "kk" | "ru" | "en";
  group_id: string | null;
};

export type AuthenticatedUser = {
  id: string;
  schoolId: string;
  role: Role;
  displayName: string;
  avatarUrl: string | null;
  locale: "kk" | "ru" | "en";
  groupId: string | null;
};

/**
 * Looks up a user by email (parent/teacher/admin) or login code (child)
 * and verifies the supplied secret (password or PIN) against whichever
 * hash is present. Goes through the `auth_lookup_credentials` security
 * definer function (see 0004_auth_functions.sql) — never a raw SELECT —
 * because no tenant/session context exists yet at login time.
 */
export async function authenticate(
  identifier: string,
  secret: string
): Promise<AuthenticatedUser | null> {
  const rows = await withSystemContext(
    (sql) => sql<CredentialRow[]>`select * from auth_lookup_credentials(${identifier})`
  );
  const row = rows[0];
  if (!row) return null;

  const hash = row.role === "CHILD" ? row.pin_hash : row.password_hash;
  const ok = await verifySecret(secret, hash);
  if (!ok) return null;

  await withSystemContext((sql) => sql`select auth_record_login(${row.id})`);

  return {
    id: row.id,
    schoolId: row.school_id,
    role: row.role,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    locale: row.locale,
    groupId: row.group_id,
  };
}
