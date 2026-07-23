"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { CatchAnswer, CatchConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { playSound } from "@/lib/sound/game-sounds";
import { useShuffledOnMount } from "@/hooks/use-shuffled-on-mount";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { cn } from "@/lib/utils";

/** Items appear one at a time; tap to "catch" it. A shrinking bar (no
 * numbers to read) shows how long it'll stay — catching a fruit or
 * correctly letting trash pass both count as a win, matching the
 * "wrong answer never fails" rule. */
export function CatchPlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: CatchConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const showMs = config.showMs ?? 1600;
  const [items, reshuffleItems] = useShuffledOnMount(config.items);
  const [index, setIndex] = React.useState(0);
  const [tapped, setTapped] = React.useState(false);
  const [feedback, setFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [answers, setAnswers] = React.useState<CatchAnswer[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const current = items?.[index];
  const done = items != null && index >= items.length;

  const advance = React.useCallback(
    async (wasTapped: boolean) => {
      if (!current || !items) return;
      const correct = current.isGood ? wasTapped : !wasTapped;
      setFeedback(correct ? "correct" : "incorrect");
      if (correct) mascotRef.current?.praise();
      const next = [...answers, { itemId: current.id, tapped: wasTapped }];
      setAnswers(next);

      setTimeout(async () => {
        setFeedback(null);
        setTapped(false);
        if (index + 1 >= items.length) {
          setSubmitting(true);
          const res = await submitGenericGameRound(locale, gameKey, next);
          setSubmitting(false);
          if (res.ok) {
            setResult(res.result);
            setBadgeEarned(res.badgeEarned);
            router.refresh();
          }
        }
        setIndex((i) => i + 1);
      }, 500);
    },
    [current, items, answers, index, locale, gameKey, router]
  );

  React.useEffect(() => {
    if (!current || tapped || feedback) return;
    const t = setTimeout(() => advance(false), showMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, tapped, feedback]);

  function catchIt() {
    if (tapped || feedback || !current) return;
    setTapped(true);
    playSound("catch");
    advance(true);
  }

  function playAgain() {
    reshuffleItems();
    setIndex(0);
    setTapped(false);
    setFeedback(null);
    setAnswers([]);
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
    <div className="flex flex-col items-center gap-8">
      <Mascot ref={mascotRef} locale={locale} />

      <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
        {current && !feedback && (
          <div
            key={current.id}
            className="h-full rounded-full bg-primary [animation-duration:var(--catch-ms)] [animation-fill-mode:forwards] [animation-name:catch-timer] [animation-timing-function:linear]"
            style={{ "--catch-ms": `${showMs}ms` } as React.CSSProperties}
          />
        )}
      </div>

      <button
        type="button"
        onClick={catchIt}
        disabled={!!feedback}
        aria-label="catch"
        className={cn(
          "flex size-40 items-center justify-center rounded-[2.5rem] border-4 bg-card text-8xl shadow-lg transition active:scale-90 sm:size-48",
          feedback === "correct" && "border-success bg-success/15",
          feedback === "incorrect" && "border-destructive/50 bg-destructive/10",
          !feedback && "border-border/60"
        )}
      >
        {current?.emoji}
      </button>
    </div>
  );
}
