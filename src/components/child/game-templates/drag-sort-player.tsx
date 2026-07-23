"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DragEndEvent } from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { DragSortAnswer, DragSortConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { GameDndContext } from "@/components/child/dnd/game-dnd-context";
import { DraggableTile } from "@/components/child/dnd/draggable-tile";
import { DroppableZone } from "@/components/child/dnd/droppable-zone";

function shuffledRound(items: DragSortConfig["items"], count: number) {
  return [...items].sort(() => Math.random() - 0.5).slice(0, count);
}

export function DragSortPlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: DragSortConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const roundSize = Math.min(config.roundSize ?? 5, config.items.length);
  // Starts null and is only shuffled after mount (see
  // src/hooks/use-shuffled-on-mount.ts) — a lazy useState initializer
  // here would shuffle once during SSR and again on the client's
  // pre-hydration render, causing a hydration mismatch.
  const [queue, setQueue] = React.useState<DragSortConfig["items"] | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue(shuffledRound(config.items, roundSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [attempts, setAttempts] = React.useState(0);
  const [zoneFeedback, setZoneFeedback] = React.useState<Record<string, "correct" | "incorrect">>({});
  const [answers, setAnswers] = React.useState<DragSortAnswer[]>([]);
  const [locked, setLocked] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const current = queue?.[0];
  const done = queue != null && queue.length === 0 && answers.length > 0;

  React.useEffect(() => {
    if (current && answers.length === 0) mascotRef.current?.say(current.label);
  }, [current, answers.length]);

  async function handleDragEnd(event: DragEndEvent) {
    if (!current || locked || !event.over || !queue) return;
    const zoneId = String(event.over.id);
    const correct = zoneId === current.correctCategoryId;
    setLocked(true);
    setZoneFeedback({ [zoneId]: correct ? "correct" : "incorrect" });
    const nextAttempts = attempts + 1;

    if (correct) {
      mascotRef.current?.praise();
      const next = [...answers, { itemId: current.id, attempts: nextAttempts }];
      setAnswers(next);
      setTimeout(async () => {
        setZoneFeedback({});
        setAttempts(0);
        setLocked(false);
        const rest = queue.slice(1);
        setQueue(rest);
        if (rest.length === 0) {
          setSubmitting(true);
          const res = await submitGenericGameRound(locale, gameKey, next);
          setSubmitting(false);
          if (res.ok) {
            setResult(res.result);
            setBadgeEarned(res.badgeEarned);
            router.refresh();
          }
        } else {
          mascotRef.current?.say(rest[0].label);
        }
      }, 800);
    } else {
      mascotRef.current?.encourage();
      setAttempts(nextAttempts);
      setTimeout(() => {
        setZoneFeedback({});
        setLocked(false);
      }, 700);
    }
  }

  function playAgain() {
    setQueue(shuffledRound(config.items, roundSize));
    setAnswers([]);
    setAttempts(0);
    setZoneFeedback({});
    setLocked(false);
    setResult(null);
    setBadgeEarned(false);
  }

  if (!queue) {
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
          {config.categories.map((cat) => (
            <DroppableZone
              key={cat.id}
              id={cat.id}
              emoji={cat.emoji}
              color={cat.color}
              feedback={zoneFeedback[cat.id] ?? null}
            />
          ))}
        </div>
      </div>
    </GameDndContext>
  );
}
