"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DragEndEvent } from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { DragCollectAnswer, DragCollectConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { GameDndContext } from "@/components/child/dnd/game-dnd-context";
import { DraggableTile } from "@/components/child/dnd/draggable-tile";
import { DroppableZone } from "@/components/child/dnd/droppable-zone";

const ZONE_ID = "zone";

function pickRound(config: DragCollectConfig, count: number) {
  const targets = config.items.filter((i) => i.isTarget);
  const distractors = config.items.filter((i) => !i.isTarget);
  const roundTargets = [...targets].sort(() => Math.random() - 0.5).slice(0, count);
  const roundDistractors = [...distractors].sort(() => Math.random() - 0.5).slice(0, Math.max(2, Math.floor(count / 2)));
  return [...roundTargets, ...roundDistractors].sort(() => Math.random() - 0.5);
}

export function DragCollectPlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: DragCollectConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const roundSize = Math.min(config.roundSize ?? 4, config.items.filter((i) => i.isTarget).length);
  // Starts null, shuffled only after mount — see use-shuffled-on-mount.ts.
  const [items, setItems] = React.useState<DragCollectConfig["items"] | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(pickRound(config, roundSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [placed, setPlaced] = React.useState<Set<string>>(new Set());
  const [attempts, setAttempts] = React.useState<Record<string, number>>({});
  const [zoneFeedback, setZoneFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const targetIds = React.useMemo(() => new Set((items ?? []).filter((i) => i.isTarget).map((i) => i.id)), [items]);
  const done = result !== null;

  async function handleDragEnd(event: DragEndEvent) {
    if (!event.over || String(event.over.id) !== ZONE_ID || !items) return;
    const itemId = String(event.active.id);
    if (placed.has(itemId)) return;
    const isTarget = targetIds.has(itemId);
    const nextAttempts = { ...attempts, [itemId]: (attempts[itemId] ?? 0) + 1 };
    setAttempts(nextAttempts);
    setZoneFeedback(isTarget ? "correct" : "incorrect");
    setTimeout(() => setZoneFeedback(null), 500);

    if (isTarget) {
      mascotRef.current?.praise();
      const nextPlaced = new Set(placed).add(itemId);
      setPlaced(nextPlaced);
      if (nextPlaced.size === targetIds.size) {
        const answers: DragCollectAnswer[] = [...targetIds].map((id) => ({ itemId: id, attempts: nextAttempts[id] ?? 1 }));
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
    setItems(pickRound(config, roundSize));
    setPlaced(new Set());
    setAttempts({});
    setZoneFeedback(null);
    setResult(null);
    setBadgeEarned(false);
  }

  if (!items) {
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

        <DroppableZone id={ZONE_ID} emoji={config.zoneEmoji} color={config.zoneColor} feedback={zoneFeedback} className="w-40" />

        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {items.map((item) => (
            <DraggableTile
              key={item.id}
              id={item.id}
              emoji={item.emoji}
              placed={placed.has(item.id)}
            />
          ))}
        </div>
      </div>
    </GameDndContext>
  );
}
