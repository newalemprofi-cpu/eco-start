import { describe, expect, it } from "vitest";
import { formatStat, parsePublicStats } from "@/lib/marketing/public-stats";
import { MODULE_INFO, MODULE_KEYS } from "@/lib/marketing/module-info";
import { ROLE_INFO, ROLE_KEYS } from "@/lib/marketing/role-info";

const usage = { actions: 3, users: 2, actions30d: 1 };
const valid = {
  kindergartens: 1,
  children: 25,
  teachers: 2,
  parents: 20,
  modules: Object.fromEntries(MODULE_KEYS.map((k) => [k, usage])),
};

describe("public stats parsing", () => {
  it("accepts the function's JSON (object or string form)", () => {
    expect(parsePublicStats(valid)?.children).toBe(25);
    expect(parsePublicStats(JSON.stringify(valid))?.modules.ecolab.actions).toBe(3);
  });

  it("returns null instead of guessing when the shape is wrong", () => {
    expect(parsePublicStats(null)).toBeNull();
    expect(parsePublicStats("not json")).toBeNull();
    expect(parsePublicStats({ ...valid, children: -1 })).toBeNull();
    const { modules, ...rest } = valid;
    expect(parsePublicStats({ ...rest, modules: { ...modules, ecolab: undefined } })).toBeNull();
  });

  it("never shows a bare zero as if it were a statistic", () => {
    expect(formatStat(0)).toBe("әлі жоқ");
    expect(formatStat(7)).toBe("7");
  });
});

describe("homepage info content", () => {
  it("has distinct content for all 8 modules", () => {
    expect(MODULE_KEYS).toHaveLength(8);
    const descriptions = MODULE_KEYS.map((k) => MODULE_INFO[k].description);
    expect(new Set(descriptions).size).toBe(8);
    for (const k of MODULE_KEYS) {
      expect(MODULE_INFO[k].features.length).toBeGreaterThan(0);
      expect(MODULE_INFO[k].appRoute.startsWith("/app/")).toBe(true);
    }
  });

  it("describes all 4 public roles with how-to steps", () => {
    expect(ROLE_KEYS).toEqual(["CHILD", "TEACHER", "PARENT", "SCHOOL_ADMIN"]);
    for (const k of ROLE_KEYS) expect(ROLE_INFO[k].howTo.length).toBeGreaterThan(0);
  });
});
