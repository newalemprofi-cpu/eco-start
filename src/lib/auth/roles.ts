/**
 * Pure role types/helpers with zero server-only or Next.js imports, so
 * RBAC routing logic (which dashboard a role lands on, whether a role
 * is in an allowed set) is unit-testable without booting a request
 * context. session.ts/dal.ts import from here rather than duplicating
 * it.
 */
export type Role = "CHILD" | "PARENT" | "TEACHER" | "SCHOOL_ADMIN" | "SUPER_ADMIN";

export const ALL_ROLES: Role[] = ["CHILD", "PARENT", "TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

export function roleHome(role: Role): string {
  switch (role) {
    case "CHILD":
      return "/app/child";
    case "TEACHER":
      return "/app/teacher";
    case "PARENT":
      return "/app/parent";
    case "SCHOOL_ADMIN":
      return "/app/admin";
    case "SUPER_ADMIN":
      return "/app/super-admin";
  }
}

export function isRoleAllowed(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}
