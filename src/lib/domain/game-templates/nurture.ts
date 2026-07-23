import { computeScore, type GameResult, type NurtureAnswer, type NurtureConfig } from "@/lib/domain/game-templates/types";

/** No wrong answer exists — a tap always advances the growth stage,
 * so this always scores full marks. It exists as a template mainly so
 * the reward/XP/badge plumbing stays uniform with every other game. */
export function scoreNurture(config: NurtureConfig, answer: NurtureAnswer, xpReward: number): GameResult {
  // stage 0 is the starting picture, so reaching the last stage takes
  // `stages.length - 1` taps — matches how NurturePlayer counts them.
  const completed = answer.tapsCompleted >= config.stages.length - 1;
  const { score, xpEarned } = computeScore(1, 1, xpReward);
  return {
    score: completed ? score : 0,
    xpEarned: completed ? xpEarned : 0,
    correctCount: completed ? 1 : 0,
    totalCount: 1,
    perItem: [{ tapsCompleted: answer.tapsCompleted, completed }],
  };
}
