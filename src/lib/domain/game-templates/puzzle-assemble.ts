import { computeScore, type GameResult, type PuzzleAssembleAnswer, type PuzzleAssembleConfig } from "@/lib/domain/game-templates/types";

/** Same "settle" shape as drag_collect — a piece dropped on the wrong
 * slot bounces back, so only correctly-placed pieces are ever
 * reported. Always scores 100%; attempts only shape the star rating. */
export function scorePuzzleAssemble(config: PuzzleAssembleConfig, answers: PuzzleAssembleAnswer[], xpReward: number): GameResult {
  const validIds = new Set(config.pieces.map((p) => p.id));
  const perItem = answers
    .filter((a) => validIds.has(a.pieceId))
    .map((a) => ({ pieceId: a.pieceId, attempts: a.attempts, correct: true }));
  const { score, xpEarned } = computeScore(perItem.length, perItem.length, xpReward);
  return { score, xpEarned, correctCount: perItem.length, totalCount: perItem.length, perItem };
}
