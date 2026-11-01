import { describe, expect, it } from "vitest";
import {
  ALL_STAGE_KEYS,
  getPlant,
  PLANT_CATALOG,
  PLANT_CATEGORIES,
  plantsInCategory,
  UNKNOWN_PLANT,
} from "@/lib/domain/plant-catalog";
import { addGrowthLogSchema, createPlantSchema } from "@/lib/validation/greenhouse";

describe("plant catalog", () => {
  it("has every vegetable the task lists", () => {
    const names = plantsInCategory("vegetables").map((p) => p.name);
    for (const n of ["Қызанақ", "Қияр", "Сәбіз", "Пияз", "Картоп", "Бұрыш", "Қырыққабат"]) {
      expect(names).toContain(n);
    }
  });

  it("has at least one plant in every category, with unique keys", () => {
    for (const c of PLANT_CATEGORIES) expect(plantsInCategory(c).length).toBeGreaterThan(0);
    const keys = PLANT_CATALOG.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every plant a picture, stages and care actions", () => {
    for (const p of PLANT_CATALOG) {
      expect(p.emoji).not.toBe("");
      expect(p.stages.length).toBeGreaterThanOrEqual(2);
      expect(p.care.length).toBeGreaterThan(0);
    }
  });

  it("falls back to a generic plant for legacy entries without a key", () => {
    expect(getPlant(null)).toBe(UNKNOWN_PLANT);
    expect(getPlant("no-such-plant")).toBe(UNKNOWN_PLANT);
    expect(getPlant("tomato").name).toBe("Қызанақ");
  });
});

describe("greenhouse validation", () => {
  it("accepts a catalog plant and still accepts a legacy request without one", () => {
    expect(createPlantSchema.safeParse({ nickname: "Қызанақ", waterSchedule: "every_day", plantKey: "tomato" }).success).toBe(true);
    expect(createPlantSchema.safeParse({ nickname: "Гүл", waterSchedule: "every_day" }).success).toBe(true);
    expect(createPlantSchema.safeParse({ nickname: "X", waterSchedule: "every_day", plantKey: "hack" }).success).toBe(false);
  });

  it("accepts a picture-only growth log (leaf count / stage, no typed number)", () => {
    expect(addGrowthLogSchema.safeParse({ leafCount: "3" }).data?.leafCount).toBe(3);
    expect(addGrowthLogSchema.safeParse({ stage: ALL_STAGE_KEYS[0] }).success).toBe(true);
    expect(addGrowthLogSchema.safeParse({ stage: "drop table" }).success).toBe(false);
    expect(addGrowthLogSchema.safeParse({ leafCount: "99" }).success).toBe(false);
  });
});
