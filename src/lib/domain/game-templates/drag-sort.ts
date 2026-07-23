import { computeScore, type DragSortAnswer, type DragSortConfig, type GameResult } from "@/lib/domain/game-templates/types";

/** A "settle" game — the UI only lets an item be dropped on its own
 * correct zone (a wrong drop bounces back and the child tries again),
 * so every reported item is correct by construction. Always scores
 * 100%; `attempts` only shapes the client-side star rating. */
export function scoreDragSort(config: DragSortConfig, answers: DragSortAnswer[], xpReward: number): GameResult {
  const validIds = new Set(config.items.map((i) => i.id));
  const perItem = answers
    .filter((a) => validIds.has(a.itemId))
    .map((a) => ({ itemId: a.itemId, attempts: a.attempts, correct: true }));
  const { score, xpEarned } = computeScore(perItem.length, perItem.length, xpReward);
  return { score, xpEarned, correctCount: perItem.length, totalCount: perItem.length, perItem };
}
