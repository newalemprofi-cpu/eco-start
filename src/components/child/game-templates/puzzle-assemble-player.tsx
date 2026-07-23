"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DragEndEvent } from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { PuzzleAssembleAnswer, PuzzleAssembleConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { GameDndContext } from "@/components/child/dnd/game-dnd-context";
import { DraggableTile } from "@/components/child/dnd/draggable-tile";
import { DroppableZone } from "@/components/child/dnd/droppable-zone";

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function PuzzleAssemblePlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: PuzzleAssembleConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  // Starts null, shuffled only after mount — see use-shuffled-on-mount.ts.
  const [tray, setTray] = React.useState<PuzzleAssembleConfig["pieces"] | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTray(shuffled(config.pieces));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [placedBySlot, setPlacedBySlot] = React.useState<Record<string, string>>({});
  const [attempts, setAttempts] = React.useState<Record<string, number>>({});
  const [slotFeedback, setSlotFeedback] = React.useState<Record<string, "correct" | "incorrect">>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const done = result !== null;

  async function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    const pieceId = String(event.active.id);
    const slotId = String(event.over.id);
    if (placedBySlot[slotId]) return;
    const piece = config.pieces.find((p) => p.id === pieceId);
    if (!piece) return;

    const correct = piece.slotId === slotId;
    const nextAttempts = { ...attempts, [pieceId]: (attempts[pieceId] ?? 0) + 1 };
    setAttempts(nextAttempts);
    setSlotFeedback({ [slotId]: correct ? "correct" : "incorrect" });
    setTimeout(() => setSlotFeedback({}), 500);

    if (correct) {
      mascotRef.current?.praise();
      const nextPlaced = { ...placedBySlot, [slotId]: pieceId };
      setPlacedBySlot(nextPlaced);
      if (Object.keys(nextPlaced).length === config.pieces.length) {
        const answers: PuzzleAssembleAnswer[] = config.pieces.map((p) => ({ pieceId: p.id, attempts: nextAttempts[p.id] ?? 1 }));
        setSubmitting(true);
        const res = await submitGenericGameRound(locale, gameKey, answers);
        setSubmitting(false);
        if (res.ok) {
          setResult(res.result);
          setBadgeEarned(res.badgeEarned);
          router.refresh();
        }
      }
    } else {
      mascotRef.current?.encourage();
    }
  }

  function playAgain() {
    setTray(shuffled(config.pieces));
    setPlacedBySlot({});
    setAttempts({});
    setSlotFeedback({});
    setResult(null);
    setBadgeEarned(false);
  }

  if (!tray) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (done) {
    return (
      <GameResultScreen locale={locale} submitting={submitting} result={result} badgeEarned={badgeEarned} onPlayAgain={playAgain} />
    );
  }

  const remainingTray = tray.filter((p) => placedBySlot[p.slotId] !== p.id);

  return (
    <GameDndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center gap-8">
        <Mascot ref={mascotRef} locale={locale} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {config.slots.map((slot) => {
            const placedPieceId = placedBySlot[slot.id];
            const placedPiece = placedPieceId ? config.pieces.find((p) => p.id === placedPieceId) : null;
            return (
              <DroppableZone
                key={slot.id}
                id={slot.id}
                emoji={placedPiece ? undefined : slot.emoji}
                feedback={slotFeedback[slot.id] ?? null}
                className="min-h-24 min-w-24 sm:min-h-28 sm:min-w-28"
              >
                {placedPiece && (
                  <span className="animate-in zoom-in-75 text-4xl duration-300 sm:text-5xl" aria-hidden>
                    {placedPiece.emoji}
                  </span>
                )}
              </DroppableZone>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {remainingTray.map((piece) => (
            <DraggableTile key={piece.id} id={piece.id} emoji={piece.emoji} size="sm" />
          ))}
        </div>
      </div>
    </GameDndContext>
  );
}
