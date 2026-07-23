import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/validation/auth";

describe("loginSchema", () => {
  it("accepts a valid email + password pair", () => {
    const result = loginSchema.safeParse({ identifier: "teacher@ecostart.local", secret: "EcoStart2026!" });
    expect(result.success).toBe(true);
  });

  it("accepts a login-code + PIN pair (children don't have email)", () => {
    const result = loginSchema.safeParse({ identifier: "child@ecostart.local", secret: "1234" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty identifier", () => {
    const result = loginSchema.safeParse({ identifier: "", secret: "1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a secret shorter than 4 characters", () => {
    const result = loginSchema.safeParse({ identifier: "child@ecostart.local", secret: "12" });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from the identifier", () => {
    const result = loginSchema.safeParse({ identifier: "  teacher@ecostart.local  ", secret: "password123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.identifier).toBe("teacher@ecostart.local");
  });
});
