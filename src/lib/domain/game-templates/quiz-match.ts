import { computeScore, type GameResult, type QuizMatchAnswer, type QuizMatchConfig } from "@/lib/domain/game-templates/types";

export function scoreQuizMatch(config: QuizMatchConfig, answers: QuizMatchAnswer[], xpReward: number): GameResult {
  const perItem = answers.map(({ questionId, chosenOptionId }) => {
    const question = config.questions.find((q) => q.id === questionId);
    const correct = Boolean(question) && question!.correctOptionId === chosenOptionId;
    return { questionId, correct, correctOptionId: question?.correctOptionId ?? "" };
  });
  const correctCount = perItem.filter((r) => r.correct).length;
  const { score, xpEarned } = computeScore(correctCount, answers.length, xpReward);
  return { score, xpEarned, correctCount, totalCount: answers.length, perItem };
}
