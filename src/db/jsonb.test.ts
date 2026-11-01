import { describe, expect, it } from "vitest";
import { jsonbObjectSql, readJsonb } from "@/db/jsonb";

describe("readJsonb", () => {
  it("returns objects as-is and unwraps legacy double-encoded strings", () => {
    expect(readJsonb<{ a: number }>({ a: 1 })).toEqual({ a: 1 });
    expect(readJsonb<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(readJsonb<string[]>("[\"x\"]")).toEqual(["x"]);
  });

  it("returns null for null or unparsable input instead of throwing", () => {
    expect(readJsonb(null)).toBeNull();
    expect(readJsonb("{not json")).toBeNull();
  });

  it("builds a SQL unwrap expression for a column", () => {
    expect(jsonbObjectSql("r.ai_summary")).toContain("jsonb_typeof(r.ai_summary)");
  });
});
