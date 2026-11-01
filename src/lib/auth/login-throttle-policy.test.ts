import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, minutesUntil, throttlePolicyFromEnv } from "@/lib/auth/login-throttle-policy";

const h = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

describe("throttlePolicyFromEnv", () => {
  it("has strict defaults", () => {
    expect(throttlePolicyFromEnv({})).toEqual({
      identifierMaxFailures: 5,
      ipMaxFailures: 20,
      windowMinutes: 15,
      lockMinutes: 15,
      maxLockMinutes: 60,
    });
  });

  it("clamps env values so the throttle can't be effectively disabled", () => {
    const p = throttlePolicyFromEnv({
      LOGIN_MAX_FAILURES_PER_IDENTIFIER: "100000",
      LOGIN_MAX_FAILURES_PER_IP: "0",
      LOGIN_LOCK_MINUTES: "-5",
      LOGIN_FAILURE_WINDOW_MINUTES: "abc",
    });
    expect(p.identifierMaxFailures).toBe(10);
    expect(p.ipMaxFailures).toBe(10);
    expect(p.lockMinutes).toBe(5);
    expect(p.windowMinutes).toBe(15);
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers the proxy-set X-Real-Ip", () => {
    expect(clientIpFromHeaders(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.7");
  });

  it("uses the LAST X-Forwarded-For hop, not the client-controlled first one", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("returns null without proxy headers", () => {
    expect(clientIpFromHeaders(h({}))).toBeNull();
  });
});

describe("minutesUntil", () => {
  it("rounds up and never shows 0", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(minutesUntil(new Date("2026-01-01T00:14:01Z"), now)).toBe(15);
    expect(minutesUntil(new Date("2025-12-31T23:59:00Z"), now)).toBe(1);
  });
});
