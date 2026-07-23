import { describe, expect, it } from "vitest";
import { ALL_ROLES, isRoleAllowed, roleHome, type Role } from "@/lib/auth/roles";

describe("roleHome", () => {
  it("maps every role to a distinct dashboard route", () => {
    const routes = ALL_ROLES.map(roleHome);
    expect(new Set(routes).size).toBe(ALL_ROLES.length);
  });

  it("sends children to the child app, never an admin surface", () => {
    expect(roleHome("CHILD")).toBe("/app/child");
  });

  it("sends each role to a route that starts with /app/", () => {
    for (const role of ALL_ROLES) {
      expect(roleHome(role)).toMatch(/^\/app\//);
    }
  });
});

describe("isRoleAllowed", () => {
  it("denies a role that isn't in the allowed list — the core of requireRole()", () => {
    expect(isRoleAllowed("CHILD", ["TEACHER", "SCHOOL_ADMIN"])).toBe(false);
  });

  it("allows a role that is in the list", () => {
    expect(isRoleAllowed("TEACHER", ["TEACHER", "SCHOOL_ADMIN"])).toBe(true);
  });

  it("denies by default on an empty allow-list (fail closed, not open)", () => {
    const role: Role = "SUPER_ADMIN";
    expect(isRoleAllowed(role, [])).toBe(false);
  });
});
