/**
 * EcoGame's 15 games are content, not code: each reuses one of these
 * 10 interaction patterns with its own catalog stored in `games.config`
 * (jsonb). Adding a 16th game later means writing a seed row, not a
 * new client component.
 *
 * `waste_sorting` (the original game) keeps its own dedicated route
 * for history reasons, but its *presentation* now goes through the
 * same real drag-and-drop as every other drag_sort game — see
 * src/components/child/waste-sorting-game.tsx. Its server-side scoring
 * (src/lib/domain/waste-sorting.ts) is untouched.
 *
 * Every template's `scoreAttempt` is pure and re-derives correctness
 * from the server-held config, never from client-claimed correctness —
 * same anti-tampering rule as waste-sorting.ts.
 *
 * Preschoolers can't read, so nothing here fails a child outright:
 * templates split into two families —
 *  - "settle" games (drag_sort, drag_collect, puzzle_assemble): a
 *    wrong drop just bounces back, the child keeps trying the same
 *    item, and only a *correct* placement ever gets submitted — so
 *    these always score 100%, XP included. The one thing tracked is
 *    how many attempts it took, purely for the star rating.
 *  - "single-pass" games (quiz_match, click_target, sequence_order,
 *    sound_match, catch): one attempt per round, right or wrong, then
 *    move on — the mascot's "try again" phrase (not a failure screen)
 *    is the only consequence of a miss.
 *  - nurture has no wrong answer at all; it's pure repeated-tap care.
 */

export type Localized = { kk: string; ru: string; en: string };

export type GameTemplate =
  | "drag_sort"
  | "quiz_match"
  | "click_target"
  | "sequence_order"
  | "scenario_decision"
  | "nurture"
  | "drag_collect"
  | "puzzle_assemble"
  | "sound_match"
  | "catch";

/** Shared result shape every template's scorer returns — this is what
 * gets persisted to game_sessions and what awardXp/badge logic reads. */
export type GameResult = {
  score: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
  perItem: unknown[];
};

const POINTS_PER_CORRECT = 10;

/** xpReward is the game's configured max XP for a perfect round (games.xp_reward);
 * partial rounds earn a proportional share. */
export function computeScore(correctCount: number, totalCount: number, xpReward: number): { score: number; xpEarned: number } {
  const score = correctCount * POINTS_PER_CORRECT;
  const xpEarned = totalCount > 0 ? Math.round((xpReward * correctCount) / totalCount) : 0;
  return { score, xpEarned };
}

// ── drag_sort ────────────────────────────────────────────────────────

export type SortCategory = { id: string; label: Localized; color: string; emoji: string };
export type SortItem = { id: string; emoji: string; label: Localized; correctCategoryId: string };
export type DragSortConfig = { categories: SortCategory[]; items: SortItem[]; roundSize?: number };
/** "Settle" game — a wrong drop bounces back in the UI, so only a
 * correctly-placed item is ever reported (see the family note above). */
export type DragSortAnswer = { itemId: string; attempts: number };

// ── quiz_match ───────────────────────────────────────────────────────

export type QuizOption = { id: string; emoji: string; label: Localized };
export type QuizQuestion = {
  id: string;
  prompt: Localized;
  emoji?: string;
  options: QuizOption[];
  correctOptionId: string;
};
export type QuizMatchConfig = { questions: QuizQuestion[] };
export type QuizMatchAnswer = { questionId: string; chosenOptionId: string };

// ── click_target ─────────────────────────────────────────────────────

export type ClickTargetItem = { id: string; emoji: string; label: Localized; isTarget: boolean };
export type ClickTargetRound = { id: string; prompt: Localized; items: ClickTargetItem[] };
export type ClickTargetConfig = { rounds: ClickTargetRound[] };
export type ClickTargetAnswer = { roundId: string; selectedItemIds: string[] };

// ── sequence_order ───────────────────────────────────────────────────

export type SequenceStep = { id: string; emoji: string; label: Localized };
/** `steps` is stored in the correct order — the UI shuffles it for display. */
export type Sequence = { id: string; prompt: Localized; steps: SequenceStep[] };
export type SequenceOrderConfig = { sequences: Sequence[] };
export type SequenceOrderAnswer = { sequenceId: string; orderedStepIds: string[] };

// ── scenario_decision ────────────────────────────────────────────────

export type ScenarioChoice = { id: string; label: Localized; isBest: boolean };
export type Scenario = { id: string; prompt: Localized; emoji: string; choices: ScenarioChoice[] };
export type ScenarioDecisionConfig = { scenarios: Scenario[] };
export type ScenarioDecisionAnswer = { scenarioId: string; chosenChoiceId: string };

// ── nurture (no wrong answer — repeated tap care, e.g. water a flower) ─

export type NurtureConfig = {
  /** Emoji shown at each growth stage, from start to fully grown. */
  stages: string[];
  /** The tile the child taps repeatedly (e.g. a watering can). */
  actionEmoji: string;
  /** Shown briefly on the final stage (e.g. butterflies, birds). */
  celebrationEmoji: string;
};
export type NurtureAnswer = { tapsCompleted: number };

// ── drag_collect (drag matching items into one zone; distractors bounce back) ─

export type CollectItem = { id: string; emoji: string; label: Localized; isTarget: boolean };
export type DragCollectConfig = {
  zoneEmoji: string;
  zoneColor: string;
  items: CollectItem[];
  roundSize?: number;
};
/** Only successfully-collected items are ever reported — a distractor
 * bounces back in the UI and never becomes an "answer". */
export type DragCollectAnswer = { itemId: string; attempts: number };

// ── puzzle_assemble (drag pieces onto their matching slot) ─────────────

export type PuzzlePiece = { id: string; emoji: string; slotId: string };
export type PuzzleSlot = { id: string; emoji: string };
export type PuzzleAssembleConfig = { pieces: PuzzlePiece[]; slots: PuzzleSlot[] };
export type PuzzleAssembleAnswer = { pieceId: string; attempts: number };

// ── sound_match (play a sound, tap the matching picture) ───────────────

export type NatureSoundId = "bird" | "rain" | "wind" | "bee";
export type SoundMatchOption = { id: string; emoji: string; label: Localized };
export type SoundMatchRound = { id: string; sound: NatureSoundId; options: SoundMatchOption[]; correctOptionId: string };
export type SoundMatchConfig = { rounds: SoundMatchRound[] };
export type SoundMatchAnswer = { roundId: string; chosenOptionId: string };

// ── catch (tap fruit as it appears, let trash pass) ─────────────────────

export type CatchItem = { id: string; emoji: string; isGood: boolean };
export type CatchConfig = { items: CatchItem[]; showMs?: number };
export type CatchAnswer = { itemId: string; tapped: boolean };
