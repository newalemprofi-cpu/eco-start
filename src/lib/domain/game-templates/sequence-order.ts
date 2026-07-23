import { computeScore, type GameResult, type SequenceOrderAnswer, type SequenceOrderConfig } from "@/lib/domain/game-templates/types";

/** A sequence is correct only if the child's tap order exactly matches
 * `steps` (which is stored pre-sorted into the correct order). */
export function scoreSequenceOrder(config: SequenceOrderConfig, answers: SequenceOrderAnswer[], xpReward: number): GameResult {
  const perItem = answers.map(({ sequenceId, orderedStepIds }) => {
    const sequence = config.sequences.find((s) => s.id === sequenceId);
    const correctOrder = (sequence?.steps ?? []).map((s) => s.id);
    const correct =
      Boolean(sequence) &&
      orderedStepIds.length === correctOrder.length &&
      orderedStepIds.every((id, i) => id === correctOrder[i]);
    return { sequenceId, correct, correctOrder };
  });
  const correctCount = perItem.filter((r) => r.correct).length;
  const { score, xpEarned } = computeScore(correctCount, answers.length, xpReward);
  return { score, xpEarned, correctCount, totalCount: answers.length, perItem };
}
