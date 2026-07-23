import { describe, expect, it } from "vitest";
import { applyXpGain, levelForXp, levelProgressPercent, xpNeededForNextLevel } from "@/lib/domain/xp";

describe("levelForXp", () => {
  it("starts at level 1 with 0 xp", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("levels up every 100 xp", () => {
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(250)).toBe(3);
  });

  it("never returns a level below 1 for negative input", () => {
    expect(levelForXp(-50)).toBe(1);
  });
});

describe("xpNeededForNextLevel / levelProgressPercent", () => {
  it("computes remaining xp within the current level", () => {
    expect(xpNeededForNextLevel(0)).toBe(100);
    expect(xpNeededForNextLevel(30)).toBe(70);
    expect(xpNeededForNextLevel(100)).toBe(100);
  });

  it("computes progress percent within the current level", () => {
    expect(levelProgressPercent(0)).toBe(0);
    expect(levelProgressPercent(50)).toBe(50);
    expect(levelProgressPercent(99)).toBe(99);
  });
});

describe("applyXpGain", () => {
  it("reports leveledUp=true when crossing a threshold", () => {
    const result = applyXpGain(95, 10);
    expect(result.newXp).toBe(105);
    expect(result.previousLevel).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.leveledUp).toBe(true);
  });

  it("reports leveledUp=false when staying within the same level", () => {
    const result = applyXpGain(10, 5);
    expect(result.newXp).toBe(15);
    expect(result.leveledUp).toBe(false);
  });

  it("never lets xp go negative even with a large negative delta", () => {
    const result = applyXpGain(5, -100);
    expect(result.newXp).toBe(0);
  });
});
