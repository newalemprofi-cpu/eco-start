import { computeScore, type GameResult, type SoundMatchAnswer, type SoundMatchConfig } from "@/lib/domain/game-templates/types";

export function scoreSoundMatch(config: SoundMatchConfig, answers: SoundMatchAnswer[], xpReward: number): GameResult {
  const perItem = answers.map(({ roundId, chosenOptionId }) => {
    const round = config.rounds.find((r) => r.id === roundId);
    const correct = Boolean(round) && round!.correctOptionId === chosenOptionId;
    return { roundId, correct, correctOptionId: round?.correctOptionId ?? "" };
  });
  const correctCount = perItem.filter((r) => r.correct).length;
  const { score, xpEarned } = computeScore(correctCount, answers.length, xpReward);
  return { score, xpEarned, correctCount, totalCount: answers.length, perItem };
}
