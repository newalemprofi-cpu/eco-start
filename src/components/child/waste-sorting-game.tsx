"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DragEndEvent } from "@dnd-kit/core";
import { submitWasteSortingRound } from "@/app/[locale]/app/child/games/waste-sorting/actions";
import { WASTE_BINS, WASTE_ITEMS, type WasteBin, type WasteItem } from "@/lib/domain/waste-sorting";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { GameDndContext } from "@/components/child/dnd/game-dnd-context";
import { DraggableTile } from "@/components/child/dnd/draggable-tile";
import { DroppableZone } from "@/components/child/dnd/droppable-zone";

const BIN_COLORS: Record<WasteBin, string> = {
  paper: "#2563eb",
  plastic: "#f59e0b",
  glass: "#10b981",
  organic: "#78350f",
};

const BIN_EMOJI: Record<WasteBin, string> = {
  paper: "📰",
  plastic: "🧴",
  glass: "🫙",
  organic: "🍂",
};

function shuffledRound(count = 6): WasteItem[] {
  return [...WASTE_ITEMS].sort(() => Math.random() - 0.5).slice(0, count);
}

type Locale = "kk" | "ru" | "en";

/** Drag the item onto its bin — a wrong drop just bounces back (never
 * a fail), so this always finishes with full marks; see the "settle"
 * family note in src/lib/domain/game-templates/types.ts. Same backend
 * (submitWasteSortingRound / scoreWasteSortingAttempt) as before —
 * only the interaction changed, from tap-a-button to real drag. */
export function WasteSortingGame({ locale }: { locale: Locale }) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const [queue, setQueue] = React.useState<WasteItem[] | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue(shuffledRound());
  }, []);
  const [answers, setAnswers] = React.useState<{ itemId: string; chosenBin: WasteBin }[]>([]);
  const [zoneFeedback, setZoneFeedback] = React.useState<Record<string, "correct" | "incorrect">>({});
  const [locked, setLocked] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ score: number; xpEarned: number; correctCount: number; totalCount: number } | null>(null);

  const current = queue?.[0];
  const done = queue != null && queue.length === 0 && answers.length > 0;

  React.useEffect(() => {
    if (current && answers.length === 0) mascotRef.current?.say(current.labels);
  }, [current, answers.length]);

  async function handleDragEnd(event: DragEndEvent) {
    if (!current || locked || !event.over) return;
    const bin = String(event.over.id) as WasteBin;
    const correct = current.correctBin === bin;
    setLocked(true);
    setZoneFeedback({ [bin]: correct ? "correct" : "incorrect" });

    if (correct) {
      mascotRef.current?.praise();
      const next = [...answers, { itemId: current.id, chosenBin: bin }];
      setAnswers(next);
      setTimeout(async () => {
        setZoneFeedback({});
        setLocked(false);
        const rest = queue!.slice(1);
        setQueue(rest);
        if (rest.length === 0) {
          setSubmitting(true);
          const res = await submitWasteSortingRound(locale, next);
          setSubmitting(false);
          if (res.ok) {
            setResult(res.result);
            router.refresh();
          }
        } else {
          mascotRef.current?.say(rest[0].labels);
        }
      }, 800);
    } else {
      mascotRef.current?.encourage();
      setTimeout(() => {
        setZoneFeedback({});
        setLocked(false);
      }, 700);
    }
  }

  function playAgain() {
    setQueue(shuffledRound());
    setAnswers([]);
    setZoneFeedback({});
    setLocked(false);
    setResult(null);
  }

  if (!queue) return null;

  if (done) {
    return (
      <GameResultScreen locale={locale} submitting={submitting} result={result} badgeEarned={false} onPlayAgain={playAgain} />
    );
  }

  return (
    <GameDndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center gap-8">
        <Mascot ref={mascotRef} locale={locale} />

        {current && (
          <div className="flex justify-center">
            <DraggableTile id={current.id} emoji={current.emoji} size="lg" disabled={locked} />
          </div>
        )}

        <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          {WASTE_BINS.map((bin) => (
            <DroppableZone
              key={bin}
              id={bin}
              emoji={BIN_EMOJI[bin]}
              color={BIN_COLORS[bin]}
              feedback={zoneFeedback[bin] ?? null}
            />
          ))}
        </div>
      </div>
    </GameDndContext>
  );
}
