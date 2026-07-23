"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { NurtureConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { playSound } from "@/lib/sound/game-sounds";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { TapTile } from "@/components/child/tap-tile";

/** No wrong answer — every tap on the action tile advances the
 * growing thing one stage, until it fully blooms/grows. */
export function NurturePlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: NurtureConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const [stage, setStage] = React.useState(0);
  const [celebrating, setCelebrating] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const lastStage = config.stages.length - 1;
  const done = result !== null;

  function tapAction() {
    if (celebrating || stage >= lastStage) return;
    const nextStage = stage + 1;
    setStage(nextStage);
    playSound("catch");
    if (nextStage >= lastStage) {
      setCelebrating(true);
      mascotRef.current?.celebrate();
      setTimeout(async () => {
        setSubmitting(true);
        const res = await submitGenericGameRound(locale, gameKey, { tapsCompleted: nextStage });
        setSubmitting(false);
        if (res.ok) {
          setResult(res.result);
          setBadgeEarned(res.badgeEarned);
          router.refresh();
        }
      }, 1200);
    } else {
      mascotRef.current?.praise();
    }
  }

  function playAgain() {
    setStage(0);
    setCelebrating(false);
    setResult(null);
    setBadgeEarned(false);
  }

  if (done) {
    return (
      <GameResultScreen locale={locale} submitting={submitting} result={result} badgeEarned={badgeEarned} onPlayAgain={playAgain} />
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <Mascot ref={mascotRef} locale={locale} />

      <div className="relative flex size-56 items-center justify-center">
        <span
          key={stage}
          className="animate-in zoom-in-75 fade-in text-9xl duration-500"
          aria-hidden
        >
          {config.stages[stage]}
        </span>
        {celebrating && (
          <span className="absolute -top-2 text-5xl motion-safe:animate-bounce" aria-hidden>
            {config.celebrationEmoji}
          </span>
        )}
      </div>

      {!celebrating && !submitting && (
        <TapTile emoji={config.actionEmoji} size="lg" onTap={tapAction} className="animate-pulse" />
      )}
    </div>
  );
}
