import { describe, expect, it } from "vitest";
import { signPayload, verifyPayload } from "@/lib/ai/signed-payload";

const SECRET = "test-secret-at-least-16-chars";
const HOUR = 60 * 60 * 1000;

describe("signed AI payload", () => {
  const data = { topic: "Су", ageBand: "3-4", isMock: true, provider: "mock" };

  it("verifies an untouched payload for the same user", () => {
    const p = signPayload(SECRET, "u1", data, 1000);
    expect(verifyPayload(SECRET, "u1", p, HOUR, 2000)).toBe(true);
  });

  it("rejects a payload whose data was edited client-side", () => {
    const p = signPayload(SECRET, "u1", data, 1000);
    const tampered = { ...p, data: { ...p.data, isMock: false, provider: "gemini" } };
    expect(verifyPayload(SECRET, "u1", tampered, HOUR, 2000)).toBe(false);
  });

  it("rejects another user's payload, an expired one and a wrong secret", () => {
    const p = signPayload(SECRET, "u1", data, 1000);
    expect(verifyPayload(SECRET, "u2", p, HOUR, 2000)).toBe(false);
    expect(verifyPayload(SECRET, "u1", p, HOUR, 1000 + HOUR + 1)).toBe(false);
    expect(verifyPayload("another-secret-16chars", "u1", p, HOUR, 2000)).toBe(false);
    expect(verifyPayload(SECRET, "u1", null, HOUR, 2000)).toBe(false);
  });
});
