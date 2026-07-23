import { computeScore, type DragCollectAnswer, type DragCollectConfig, type GameResult } from "@/lib/domain/game-templates/types";

/** A "settle" game: the UI only ever lets a target item be dropped
 * into the collection zone (distractors bounce back and are never
 * submitted), so every reported item is, by construction, correct.
 * This always scores 100% — attempts-per-item only affects the star
 * rating client-side, not XP. */
export function scoreDragCollect(config: DragCollectConfig, answers: DragCollectAnswer[], xpReward: number): GameResult {
  const validIds = new Set(config.items.filter((i) => i.isTarget).map((i) => i.id));
  const perItem = answers
    .filter((a) => validIds.has(a.itemId))
    .map((a) => ({ itemId: a.itemId, attempts: a.attempts, correct: true }));
  const { score, xpEarned } = computeScore(perItem.length, perItem.length, xpReward);
  return { score, xpEarned, correctCount: perItem.length, totalCount: perItem.length, perItem };
}
