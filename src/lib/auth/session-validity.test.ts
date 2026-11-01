import { describe, expect, it } from "vitest";
import { isSessionStillValid, type SessionUserState } from "@/lib/auth/session-validity";

const SCHOOL = "11111111-1111-1111-1111-111111111111";
const session = { role: "TEACHER" as const, schoolId: SCHOOL, iat: 1_800_000_000 };
const active: SessionUserState = { role: "TEACHER", schoolId: SCHOOL, archivedAt: null, sessionsRevokedAt: null };

describe("isSessionStillValid", () => {
  it("accepts an active user's session", () => {
    expect(isSessionStillValid(session, active)).toBe(true);
  });

  it("refuses once the user is archived", () => {
    expect(isSessionStillValid(session, { ...active, archivedAt: "2027-01-01T00:00:00Z" })).toBe(false);
  });

  it("refuses when the user row is gone", () => {
    expect(isSessionStillValid(session, null)).toBe(false);
  });

  it("refuses sessions issued before (or in the same second as) a revocation", () => {
    const revokedAt = session.iat + 0.4;
    expect(isSessionStillValid(session, { ...active, sessionsRevokedAt: revokedAt })).toBe(false);
    const later = session.iat + 60;
    expect(isSessionStillValid(session, { ...active, sessionsRevokedAt: later })).toBe(false);
  });

  it("accepts a session issued after the revocation (the user logged in again)", () => {
    const earlier = session.iat - 60;
    expect(isSessionStillValid(session, { ...active, sessionsRevokedAt: earlier })).toBe(true);
  });

  it("refuses if the role or school in the token no longer matches", () => {
    expect(isSessionStillValid(session, { ...active, role: "PARENT" })).toBe(false);
    expect(isSessionStillValid(session, { ...active, schoolId: "22222222-2222-2222-2222-222222222222" })).toBe(false);
  });

  it("refuses a token without iat when a revocation exists", () => {
    expect(
      isSessionStillValid({ role: "TEACHER", schoolId: SCHOOL }, { ...active, sessionsRevokedAt: 1_900_000_000 })
    ).toBe(false);
  });
});
