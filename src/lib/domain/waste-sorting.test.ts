import { describe, expect, it } from "vitest";
import { scoreWasteSortingAttempt, WASTE_ITEMS } from "@/lib/domain/waste-sorting";

describe("scoreWasteSortingAttempt", () => {
  it("awards points and XP only for correct answers", () => {
    const [item1, item2] = WASTE_ITEMS;
    const result = scoreWasteSortingAttempt([
      { itemId: item1.id, chosenBin: item1.correctBin },
      { itemId: item2.id, chosenBin: item2.correctBin === "paper" ? "glass" : "paper" }, // deliberately wrong
    ]);

    expect(result.correctCount).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.score).toBe(10);
    expect(result.xpEarned).toBe(5);
  });

  it("gives zero score for an all-wrong round without erroring", () => {
    const result = scoreWasteSortingAttempt(
      WASTE_ITEMS.map((item) => ({
        itemId: item.id,
        chosenBin: item.correctBin === "paper" ? "glass" : "paper",
      }))
    );
    expect(result.correctCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.xpEarned).toBe(0);
  });

  it("never trusts a client-supplied correctness claim — only the server catalog matters", () => {
    // Same chosenBin, but paired with an itemId that doesn't exist —
    // must not be scored as correct just because the shape looks right.
    const result = scoreWasteSortingAttempt([{ itemId: "not-a-real-item", chosenBin: "paper" }]);
    expect(result.correctCount).toBe(0);
    expect(result.perItem[0].correct).toBe(false);
  });

  it("scores a full correct round at 100%", () => {
    const result = scoreWasteSortingAttempt(
      WASTE_ITEMS.map((item) => ({ itemId: item.id, chosenBin: item.correctBin }))
    );
    expect(result.correctCount).toBe(WASTE_ITEMS.length);
    expect(result.score).toBe(WASTE_ITEMS.length * 10);
  });
});
