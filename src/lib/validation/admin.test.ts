import { describe, expect, it } from "vitest";
import { createChildSchema } from "@/lib/validation/admin";

describe("createChildSchema", () => {
  it("accepts a valid login code and 4-digit PIN", () => {
    const result = createChildSchema.safeParse({
      displayName: "Демо бала",
      loginCode: "aika-01",
      pin: "4321",
    });
    expect(result.success).toBe(true);
  });

  it("lowercases the login code so lookups are case-insensitive", () => {
    const result = createChildSchema.safeParse({
      displayName: "Демо бала",
      loginCode: "AIKA-01",
      pin: "4321",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.loginCode).toBe("aika-01");
  });

  it("rejects a non-numeric PIN", () => {
    const result = createChildSchema.safeParse({
      displayName: "Демо бала",
      loginCode: "aika-01",
      pin: "abcd",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a login code with spaces or symbols outside a-z0-9-", () => {
    const result = createChildSchema.safeParse({
      displayName: "Демо бала",
      loginCode: "aika 01!",
      pin: "4321",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a PIN that is too short", () => {
    const result = createChildSchema.safeParse({
      displayName: "Демо бала",
      loginCode: "aika-01",
      pin: "12",
    });
    expect(result.success).toBe(false);
  });
});
