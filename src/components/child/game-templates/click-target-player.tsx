"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { ClickTargetAnswer, ClickTargetConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { useShuffledOnMount } from "@/hooks/use-shuffled-on-mount";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { TapTile } from "@/components/child/tap-tile";
import { cn } from "@/lib/utils";

export function ClickTargetPlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: ClickTargetConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const [rounds, reshuffleRounds] = useShuffledOnMount(config.rounds);
  const [index, setIndex] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [answers, setAnswers] = React.useState<ClickTargetAnswer[]>([]);
  const [feedback, setFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const current = rounds?.[index];
  const done = rounds != null && index >= rounds.length;

  React.useEffect(() => {
    if (current) mascotRef.current?.say(current.prompt);
  }, [current]);

  function toggle(itemId: string) {
    if (feedback) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function confirmRound() {
    if (!current || feedback || selected.size === 0 || !rounds) return;
    const targetIds = new Set(current.items.filter((i) => i.isTarget).map((i) => i.id));
    const correct = targetIds.size === selected.size && [...targetIds].every((id) => selected.has(id));
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) mascotRef.current?.praise();
    else mascotRef.current?.encourage();
    const next = [...answers, { roundId: current.id, selectedItemIds: [...selected] }];
    setAnswers(next);

    setTimeout(async () => {
      setFeedback(null);
      setSelected(new Set());
      if (index + 1 >= rounds.length) {
        setSubmitting(true);
        const res = await submitGenericGameRound(locale, gameKey, next);
        setSubmitting(false);
        if (res.ok) {
          setResult(res.result);
          setBadgeEarned(res.badgeEarned);
          router.refresh();
        }
      }
      setIndex(index + 1);
    }, 900);
  }

  function playAgain() {
    reshuffleRounds();
    setIndex(0);
    setSelected(new Set());
    setAnswers([]);
    setResult(null);
    setBadgeEarned(false);
    setFeedback(null);
  }

  if (!rounds) {
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
    <div className="flex flex-col items-center gap-6">
      <Mascot ref={mascotRef} locale={locale} />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {current?.items.map((item) => {
          const isSelected = selected.has(item.id);
          const tileFeedback = feedback ? (item.isTarget ? "correct" : isSelected ? "incorrect" : null) : isSelected ? "selected" : null;
          return (
            <TapTile
              key={item.id}
              emoji={item.emoji}
              ariaLabel={item.label[locale]}
              disabled={!!feedback}
              feedback={tileFeedback}
              onTap={() => toggle(item.id)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={confirmRound}
        disabled={!!feedback || selected.size === 0}
        aria-label="OK"
        className={cn(
          "flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-90 disabled:opacity-40"
        )}
      >
        <Check className="size-8" />
      </button>
    </div>
  );
}
