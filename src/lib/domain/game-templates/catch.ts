import { computeScore, type CatchAnswer, type CatchConfig, type GameResult } from "@/lib/domain/game-templates/types";

/** Correct = caught a fruit, or correctly let trash pass by without
 * tapping it. Tapping trash never "loses" — it just doesn't score,
 * matching the no-fail rule. */
export function scoreCatch(config: CatchConfig, answers: CatchAnswer[], xpReward: number): GameResult {
  const perItem = answers.map(({ itemId, tapped }) => {
    const item = config.items.find((i) => i.id === itemId);
    const isGood = item?.isGood ?? false;
    const correct = Boolean(item) && (isGood ? tapped : !tapped);
    return { itemId, correct, isGood };
  });
  const correctCount = perItem.filter((r) => r.correct).length;
  const { score, xpEarned } = computeScore(correctCount, answers.length, xpReward);
  return { score, xpEarned, correctCount, totalCount: answers.length, perItem };
}
