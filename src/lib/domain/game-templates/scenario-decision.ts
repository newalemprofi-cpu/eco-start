import { computeScore, type GameResult, type ScenarioDecisionAnswer, type ScenarioDecisionConfig } from "@/lib/domain/game-templates/types";

export function scoreScenarioDecision(
  config: ScenarioDecisionConfig,
  answers: ScenarioDecisionAnswer[],
  xpReward: number
): GameResult {
  const perItem = answers.map(({ scenarioId, chosenChoiceId }) => {
    const scenario = config.scenarios.find((s) => s.id === scenarioId);
    const choice = scenario?.choices.find((c) => c.id === chosenChoiceId);
    const correct = Boolean(choice?.isBest);
    const bestChoiceId = scenario?.choices.find((c) => c.isBest)?.id ?? "";
    return { scenarioId, correct, bestChoiceId };
  });
  const correctCount = perItem.filter((r) => r.correct).length;
  const { score, xpEarned } = computeScore(correctCount, answers.length, xpReward);
  return { score, xpEarned, correctCount, totalCount: answers.length, perItem };
}
