import type { GameTemplate } from "@/lib/domain/game-templates/types";
import { DragSortPlayer } from "@/components/child/game-templates/drag-sort-player";
import { QuizMatchPlayer } from "@/components/child/game-templates/quiz-match-player";
import { ClickTargetPlayer } from "@/components/child/game-templates/click-target-player";
import { SequenceOrderPlayer } from "@/components/child/game-templates/sequence-order-player";
import { ScenarioDecisionPlayer } from "@/components/child/game-templates/scenario-decision-player";
import { NurturePlayer } from "@/components/child/game-templates/nurture-player";
import { DragCollectPlayer } from "@/components/child/game-templates/drag-collect-player";
import { PuzzleAssemblePlayer } from "@/components/child/game-templates/puzzle-assemble-player";
import { SoundMatchPlayer } from "@/components/child/game-templates/sound-match-player";
import { CatchPlayer } from "@/components/child/game-templates/catch-player";

type Locale = "kk" | "ru" | "en";

/** Picks the right reusable interaction pattern for a game by its
 * `template` column — see src/lib/domain/game-templates/types.ts for
 * why 15 games share 10 engines instead of each getting a bespoke one.
 * (scenario_decision isn't used by any current game but stays wired
 * up — harmless, and ready to reuse for a future "which choice is
 * best" game.) */
export function GamePlayer({
  template,
  gameKey,
  locale,
  config,
}: {
  template: GameTemplate;
  gameKey: string;
  locale: Locale;
  config: unknown;
}) {
  switch (template) {
    case "drag_sort":
      return <DragSortPlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "quiz_match":
      return <QuizMatchPlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "click_target":
      return <ClickTargetPlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "sequence_order":
      return <SequenceOrderPlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "scenario_decision":
      return <ScenarioDecisionPlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "nurture":
      return <NurturePlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "drag_collect":
      return <DragCollectPlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "puzzle_assemble":
      return <PuzzleAssemblePlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "sound_match":
      return <SoundMatchPlayer gameKey={gameKey} locale={locale} config={config as never} />;
    case "catch":
      return <CatchPlayer gameKey={gameKey} locale={locale} config={config as never} />;
  }
}
