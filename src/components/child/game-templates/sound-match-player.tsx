"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Volume2 } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { SoundMatchAnswer, SoundMatchConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { playNatureSound } from "@/lib/sound/game-sounds";
import { useShuffledOnMount } from "@/hooks/use-shuffled-on-mount";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { TapTile } from "@/components/child/tap-tile";

export function SoundMatchPlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: SoundMatchConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const [rounds, reshuffleRounds] = useShuffledOnMount(config.rounds);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<SoundMatchAnswer[]>([]);
  const [chosenId, setChosenId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const current = rounds?.[index];
  const done = rounds != null && index >= rounds.length;

  React.useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => playNatureSound(current.sound), 400);
    return () => clearTimeout(t);
  }, [current]);

  async function choose(optionId: string) {
    if (!current || feedback || !rounds) return;
    setChosenId(optionId);
    const correct = current.correctOptionId === optionId;
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) mascotRef.current?.praise();
    else mascotRef.current?.encourage();
    const next = [...answers, { roundId: current.id, chosenOptionId: optionId }];
    setAnswers(next);

    setTimeout(async () => {
      setFeedback(null);
      setChosenId(null);
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
    setAnswers([]);
    setResult(null);
    setBadgeEarned(false);
    setFeedback(null);
    setChosenId(null);
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

      <button
        type="button"
        onClick={() => current && playNatureSound(current.sound)}
        aria-label="play"
        className="flex size-24 animate-pulse items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-90 sm:size-28"
      >
        <Volume2 className="size-11" />
      </button>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {current?.options.map((opt) => (
          <TapTile
            key={opt.id}
            emoji={opt.emoji}
            ariaLabel={opt.label[locale]}
            size="lg"
            disabled={!!feedback}
            feedback={chosenId === opt.id ? feedback : null}
            onTap={() => choose(opt.id)}
          />
        ))}
      </div>
    </div>
  );
}
