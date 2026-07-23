import { computeScore, type ClickTargetAnswer, type ClickTargetConfig, type GameResult } from "@/lib/domain/game-templates/types";

/** A round is correct only if the selected set exactly matches the
 * target set — no missed targets, no wrong picks. */
export function scoreClickTarget(config: ClickTargetConfig, answers: ClickTargetAnswer[], xpReward: number): GameResult {
  const perItem = answers.map(({ roundId, selectedItemIds }) => {
    const round = config.rounds.find((r) => r.id === roundId);
    const targetIds = new Set((round?.items ?? []).filter((i) => i.isTarget).map((i) => i.id));
    const selectedSet = new Set(selectedItemIds);
    const correct =
      Boolean(round) &&
      targetIds.size === selectedSet.size &&
      [...targetIds].every((id) => selectedSet.has(id));
    return { roundId, correct, targetIds: [...targetIds] };
  });
  const correctCount = perItem.filter((r) => r.correct).length;
  const { score, xpEarned } = computeScore(correctCount, answers.length, xpReward);
  return { score, xpEarned, correctCount, totalCount: answers.length, perItem };
}
