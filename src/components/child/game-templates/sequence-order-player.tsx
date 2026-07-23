"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { SequenceOrderAnswer, SequenceOrderConfig, SequenceStep } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { useShuffledOnMount } from "@/hooks/use-shuffled-on-mount";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { TapTile } from "@/components/child/tap-tile";

export function SequenceOrderPlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: SequenceOrderConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const [sequences, reshuffleSequences] = useShuffledOnMount(config.sequences);
  const [index, setIndex] = React.useState(0);
  // Shuffled per-sequence, not just once at mount — see useShuffledOnMount's
  // doc comment for why this can't be a useState lazy initializer either.
  const [shuffledSteps, setShuffledSteps] = React.useState<SequenceStep[] | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [answers, setAnswers] = React.useState<SequenceOrderAnswer[]>([]);
  const [feedback, setFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const current = sequences?.[index];
  const done = sequences != null && index >= sequences.length;

  React.useEffect(() => {
    if (!current) return;
    mascotRef.current?.say(current.prompt);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShuffledSteps([...current.steps].sort(() => Math.random() - 0.5));
  }, [current]);

  async function pick(stepId: string) {
    if (!current || feedback || picked.includes(stepId) || !sequences) return;
    const nextPicked = [...picked, stepId];
    setPicked(nextPicked);
    if (nextPicked.length < current.steps.length) return;

    const correctOrder = current.steps.map((s) => s.id);
    const correct = nextPicked.every((id, i) => id === correctOrder[i]);
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) mascotRef.current?.praise();
    else mascotRef.current?.encourage();
    const next = [...answers, { sequenceId: current.id, orderedStepIds: nextPicked }];
    setAnswers(next);

    setTimeout(async () => {
      setFeedback(null);
      setPicked([]);
      const nextIndex = index + 1;
      if (nextIndex >= sequences.length) {
        setSubmitting(true);
        const res = await submitGenericGameRound(locale, gameKey, next);
        setSubmitting(false);
        if (res.ok) {
          setResult(res.result);
          setBadgeEarned(res.badgeEarned);
          router.refresh();
        }
      }
      setIndex(nextIndex);
    }, 900);
  }

  function playAgain() {
    reshuffleSequences();
    setIndex(0);
    setPicked([]);
    setAnswers([]);
    setResult(null);
    setBadgeEarned(false);
    setFeedback(null);
  }

  if (!sequences || !shuffledSteps) {
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

      {picked.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {picked.map((id) => {
            const step = current?.steps.find((s) => s.id === id);
            return (
              <span
                key={id}
                className="flex size-11 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 text-2xl"
              >
                {step?.emoji}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {shuffledSteps.map((step) => {
          const isPicked = picked.includes(step.id);
          return (
            <TapTile
              key={step.id}
              emoji={step.emoji}
              ariaLabel={step.label[locale]}
              disabled={isPicked || !!feedback}
              feedback={isPicked ? "selected" : null}
              onTap={() => pick(step.id)}
              className={isPicked ? "opacity-30" : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
