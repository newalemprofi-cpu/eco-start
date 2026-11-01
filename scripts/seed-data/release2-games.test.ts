import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RELEASE2_GAMES } from "./release2-games";
import { GENERATED_BEGIN, GENERATED_END, release2GamesSql } from "./release2-games-sql";
import { scoreClickTarget } from "@/lib/domain/game-templates/click-target";
import { scorePuzzleAssemble } from "@/lib/domain/game-templates/puzzle-assemble";
import { scoreDragSort } from "@/lib/domain/game-templates/drag-sort";
import { scoreSoundMatch } from "@/lib/domain/game-templates/sound-match";
import { scoreSequenceOrder } from "@/lib/domain/game-templates/sequence-order";
import { scoreQuizMatch } from "@/lib/domain/game-templates/quiz-match";
import { scoreScenarioDecision } from "@/lib/domain/game-templates/scenario-decision";
import type {
  ClickTargetConfig,
  DragSortConfig,
  GameResult,
  PuzzleAssembleConfig,
  QuizMatchConfig,
  ScenarioDecisionConfig,
  SequenceOrderConfig,
  SoundMatchConfig,
} from "@/lib/domain/game-templates/types";

const MIGRATION = path.join(__dirname, "../../src/db/migrations/0016_release2_users_games.sql");

/** A perfect round, built from the catalog the same way each player does. */
function perfectRound(g: (typeof RELEASE2_GAMES)[number]): GameResult {
  switch (g.template) {
    case "click_target": {
      const c = g.config as ClickTargetConfig;
      return scoreClickTarget(c, c.rounds.map((r) => ({ roundId: r.id, selectedItemIds: r.items.filter((i) => i.isTarget).map((i) => i.id) })), g.xpReward);
    }
    case "puzzle_assemble": {
      const c = g.config as PuzzleAssembleConfig;
      return scorePuzzleAssemble(c, c.pieces.map((p) => ({ pieceId: p.id, attempts: 1 })), g.xpReward);
    }
    case "drag_sort": {
      const c = g.config as DragSortConfig;
      return scoreDragSort(c, c.items.map((i) => ({ itemId: i.id, attempts: 1 })), g.xpReward);
    }
    case "sound_match": {
      const c = g.config as SoundMatchConfig;
      return scoreSoundMatch(c, c.rounds.map((r) => ({ roundId: r.id, chosenOptionId: r.correctOptionId })), g.xpReward);
    }
    case "sequence_order": {
      const c = g.config as SequenceOrderConfig;
      return scoreSequenceOrder(c, c.sequences.map((s) => ({ sequenceId: s.id, orderedStepIds: s.steps.map((st) => st.id) })), g.xpReward);
    }
    case "quiz_match": {
      const c = g.config as QuizMatchConfig;
      return scoreQuizMatch(c, c.questions.map((q) => ({ questionId: q.id, chosenOptionId: q.correctOptionId })), g.xpReward);
    }
    case "scenario_decision": {
      const c = g.config as ScenarioDecisionConfig;
      return scoreScenarioDecision(c, c.scenarios.map((s) => ({ scenarioId: s.id, chosenChoiceId: s.choices.find((ch) => ch.isBest)!.id })), g.xpReward);
    }
  }
}

describe("Release 2 games catalog", () => {
  it("has exactly ten games, 4 + 3 + 3 across the three age groups", () => {
    expect(RELEASE2_GAMES).toHaveLength(10);
    const by = (c: string) => RELEASE2_GAMES.filter((g) => g.ageCategories.includes(c as never)).length;
    expect([by("MIDDLE_3"), by("SENIOR_4"), by("PRESCHOOL_5")]).toEqual([4, 3, 3]);
  });

  it("uses unique keys that don't collide with the existing 15 games", () => {
    const keys = RELEASE2_GAMES.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k.startsWith("r2-")).toBe(true);
  });

  it("every game has a Kazakh title and description", () => {
    for (const g of RELEASE2_GAMES) {
      expect(g.title.kk.length, g.key).toBeGreaterThan(2);
      expect(g.description.kk.length, g.key).toBeGreaterThan(2);
    }
  });

  it("a perfect round of every game scores 100% and pays exactly its xp_reward", () => {
    for (const g of RELEASE2_GAMES) {
      const r = perfectRound(g);
      expect(r.totalCount, g.key).toBeGreaterThan(0);
      expect(r.correctCount, g.key).toBe(r.totalCount);
      expect(r.xpEarned, g.key).toBe(g.xpReward);
    }
  });

  it("every round has a real decision: at least one right and one wrong option", () => {
    for (const g of RELEASE2_GAMES) {
      const c = g.config as Record<string, unknown>;
      if (g.template === "click_target") {
        for (const r of (c as ClickTargetConfig).rounds) {
          expect(r.items.some((i) => i.isTarget) && r.items.some((i) => !i.isTarget), `${g.key}/${r.id}`).toBe(true);
        }
      }
      if (g.template === "quiz_match") {
        for (const q of (c as QuizMatchConfig).questions) {
          expect(q.options.map((o) => o.id)).toContain(q.correctOptionId);
          expect(q.options.length).toBeGreaterThan(1);
        }
      }
      if (g.template === "sound_match") {
        for (const r of (c as SoundMatchConfig).rounds) expect(r.options.map((o) => o.id)).toContain(r.correctOptionId);
      }
      if (g.template === "scenario_decision") {
        for (const s of (c as ScenarioDecisionConfig).scenarios) {
          expect(s.choices.filter((ch) => ch.isBest)).toHaveLength(1);
          expect(s.choices.length).toBeGreaterThan(1);
        }
      }
      if (g.template === "puzzle_assemble") {
        const p = c as PuzzleAssembleConfig;
        const slots = new Set(p.slots.map((s) => s.id));
        for (const piece of p.pieces) expect(slots.has(piece.slotId)).toBe(true);
      }
      if (g.template === "drag_sort") {
        const d = c as DragSortConfig;
        const cats = new Set(d.categories.map((x) => x.id));
        for (const item of d.items) expect(cats.has(item.correctCategoryId)).toBe(true);
      }
    }
  });

  it("migration 0016 contains exactly the generated block for this catalog", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const start = sql.indexOf(GENERATED_BEGIN);
    const end = sql.indexOf(GENERATED_END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(sql.slice(start, end + GENERATED_END.length)).toBe(release2GamesSql());
  });
});
