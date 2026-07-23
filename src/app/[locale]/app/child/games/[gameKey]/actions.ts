"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getGameByKey, recordGameSession } from "@/db/repo/games";
import { awardXp } from "@/db/repo/xp";
import { awardBadgeIfNotEarned } from "@/db/repo/achievements";
import { scoreDragSort } from "@/lib/domain/game-templates/drag-sort";
import { scoreQuizMatch } from "@/lib/domain/game-templates/quiz-match";
import { scoreClickTarget } from "@/lib/domain/game-templates/click-target";
import { scoreSequenceOrder } from "@/lib/domain/game-templates/sequence-order";
import { scoreScenarioDecision } from "@/lib/domain/game-templates/scenario-decision";
import { scoreNurture } from "@/lib/domain/game-templates/nurture";
import { scoreDragCollect } from "@/lib/domain/game-templates/drag-collect";
import { scorePuzzleAssemble } from "@/lib/domain/game-templates/puzzle-assemble";
import { scoreSoundMatch } from "@/lib/domain/game-templates/sound-match";
import { scoreCatch } from "@/lib/domain/game-templates/catch";
import type {
  CatchConfig,
  ClickTargetConfig,
  DragCollectConfig,
  DragSortConfig,
  GameResult,
  NurtureConfig,
  PuzzleAssembleConfig,
  QuizMatchConfig,
  ScenarioDecisionConfig,
  SequenceOrderConfig,
  SoundMatchConfig,
} from "@/lib/domain/game-templates/types";

// A round earning at least this share of correct answers unlocks the
// game's badge (if it has one) — matches the "strong performance"
// threshold, not just "finished".
const BADGE_THRESHOLD = 0.8;

const answerSchemas = {
  drag_sort: z.array(z.object({ itemId: z.string().min(1), attempts: z.number().int().min(1).max(20) })).min(1).max(20),
  quiz_match: z.array(z.object({ questionId: z.string().min(1), chosenOptionId: z.string().min(1) })).min(1).max(20),
  click_target: z
    .array(z.object({ roundId: z.string().min(1), selectedItemIds: z.array(z.string().min(1)).max(20) }))
    .min(1)
    .max(20),
  sequence_order: z
    .array(z.object({ sequenceId: z.string().min(1), orderedStepIds: z.array(z.string().min(1)).min(1).max(10) }))
    .min(1)
    .max(20),
  scenario_decision: z
    .array(z.object({ scenarioId: z.string().min(1), chosenChoiceId: z.string().min(1) }))
    .min(1)
    .max(20),
  // Nurture has no wrong answer and no per-item list — a single
  // completion report, not an array like every other template.
  nurture: z.object({ tapsCompleted: z.number().int().min(0).max(50) }),
  drag_collect: z.array(z.object({ itemId: z.string().min(1), attempts: z.number().int().min(1).max(20) })).min(1).max(20),
  puzzle_assemble: z.array(z.object({ pieceId: z.string().min(1), attempts: z.number().int().min(1).max(20) })).min(1).max(20),
  sound_match: z.array(z.object({ roundId: z.string().min(1), chosenOptionId: z.string().min(1) })).min(1).max(20),
  catch: z.array(z.object({ itemId: z.string().min(1), tapped: z.boolean() })).min(1).max(30),
};

export type SubmitGameResult =
  | { ok: true; result: GameResult; badgeEarned: boolean }
  | { ok: false; error: string };

export async function submitGenericGameRound(
  locale: string,
  gameKey: string,
  rawAnswers: unknown
): Promise<SubmitGameResult> {
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);

  const game = await getGameByKey(ctx, gameKey);
  if (!game) return { ok: false, error: "game_not_found" };

  const schema = answerSchemas[game.template];
  const parsed = schema.safeParse(rawAnswers);
  if (!parsed.success) return { ok: false, error: "validation" };

  // Scoring always re-derives correctness from the server-held config
  // (games.config), never from anything the client claims — same rule
  // as waste-sorting.ts.
  let result: GameResult;
  switch (game.template) {
    case "drag_sort":
      result = scoreDragSort(game.config as DragSortConfig, parsed.data as never, game.xpReward);
      break;
    case "quiz_match":
      result = scoreQuizMatch(game.config as QuizMatchConfig, parsed.data as never, game.xpReward);
      break;
    case "click_target":
      result = scoreClickTarget(game.config as ClickTargetConfig, parsed.data as never, game.xpReward);
      break;
    case "sequence_order":
      result = scoreSequenceOrder(game.config as SequenceOrderConfig, parsed.data as never, game.xpReward);
      break;
    case "scenario_decision":
      result = scoreScenarioDecision(game.config as ScenarioDecisionConfig, parsed.data as never, game.xpReward);
      break;
    case "nurture":
      result = scoreNurture(game.config as NurtureConfig, parsed.data as never, game.xpReward);
      break;
    case "drag_collect":
      result = scoreDragCollect(game.config as DragCollectConfig, parsed.data as never, game.xpReward);
      break;
    case "puzzle_assemble":
      result = scorePuzzleAssemble(game.config as PuzzleAssembleConfig, parsed.data as never, game.xpReward);
      break;
    case "sound_match":
      result = scoreSoundMatch(game.config as SoundMatchConfig, parsed.data as never, game.xpReward);
      break;
    case "catch":
      result = scoreCatch(game.config as CatchConfig, parsed.data as never, game.xpReward);
      break;
  }

  await recordGameSession(ctx, game.id, result);
  await awardXp(ctx, result.xpEarned);

  let badgeEarned = false;
  if (game.badgeKey && result.totalCount > 0 && result.correctCount / result.totalCount >= BADGE_THRESHOLD) {
    badgeEarned = await awardBadgeIfNotEarned(ctx, game.badgeKey);
  }

  revalidatePath(`/${locale}/app/child/games/${gameKey}`);
  revalidatePath(`/${locale}/app/child/games`);
  revalidatePath(`/${locale}/app/child`);
  revalidatePath(`/${locale}/app/child/passport`);

  return { ok: true, result, badgeEarned };
}
