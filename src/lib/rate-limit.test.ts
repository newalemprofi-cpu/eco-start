import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000);
    const result = rateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently (per-user limiting)", () => {
    const keyA = `user-a-${Math.random()}`;
    const keyB = `user-b-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(keyA, 3, 60_000);
    expect(rateLimit(keyA, 3, 60_000).allowed).toBe(false);
    expect(rateLimit(keyB, 3, 60_000).allowed).toBe(true);
  });

  it("resets the count once the window elapses", async () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 1, 30).allowed).toBe(true);
    expect(rateLimit(key, 1, 30).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(rateLimit(key, 1, 30).allowed).toBe(true);
  });
});
