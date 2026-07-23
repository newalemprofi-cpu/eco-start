"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { QuizMatchAnswer, QuizMatchConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { useShuffledOnMount } from "@/hooks/use-shuffled-on-mount";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { TapTile } from "@/components/child/tap-tile";

export function QuizMatchPlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: QuizMatchConfig;
}) {
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const [questions, reshuffleQuestions] = useShuffledOnMount(config.questions);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<QuizMatchAnswer[]>([]);
  const [chosenId, setChosenId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const current = questions?.[index];
  const done = questions != null && index >= questions.length;

  React.useEffect(() => {
    if (current) mascotRef.current?.say(current.prompt);
  }, [current]);

  async function choose(optionId: string) {
    if (!current || feedback || !questions) return;
    setChosenId(optionId);
    const correct = current.correctOptionId === optionId;
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) mascotRef.current?.praise();
    else mascotRef.current?.encourage();
    const next = [...answers, { questionId: current.id, chosenOptionId: optionId }];
    setAnswers(next);

    setTimeout(async () => {
      setFeedback(null);
      setChosenId(null);
      if (index + 1 >= questions.length) {
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
    reshuffleQuestions();
    setIndex(0);
    setAnswers([]);
    setResult(null);
    setBadgeEarned(false);
    setFeedback(null);
    setChosenId(null);
  }

  if (!questions) {
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

      {current?.emoji && (
        <span className="text-8xl" aria-hidden>
          {current.emoji}
        </span>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4">
        {current?.options.map((opt) => (
          <TapTile
            key={opt.id}
            emoji={opt.emoji}
            label={opt.label[locale]}
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
