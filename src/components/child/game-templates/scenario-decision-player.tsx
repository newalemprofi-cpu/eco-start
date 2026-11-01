"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Loader2, X } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { ScenarioDecisionAnswer, ScenarioDecisionConfig } from "@/lib/domain/game-templates/types";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { useShuffledOnMount } from "@/hooks/use-shuffled-on-mount";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { cn } from "@/lib/utils";

/** "What would you do?" — one situation, two or three big picture
 * choices. Shuffled after mount (useShuffledOnMount), never during
 * render, so server and client markup always match. */
export function ScenarioDecisionPlayer({
  gameKey,
  locale,
  config,
}: {
  gameKey: string;
  locale: Locale;
  config: ScenarioDecisionConfig;
}) {
  const t = useTranslations("game");
  const router = useRouter();
  const mascotRef = React.useRef<MascotHandle>(null);
  const [scenarios, reshuffleScenarios] = useShuffledOnMount(config.scenarios);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<ScenarioDecisionAnswer[]>([]);
  const [chosenId, setChosenId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const current = scenarios?.[index];
  const done = scenarios != null && index >= scenarios.length;

  React.useEffect(() => {
    if (current) mascotRef.current?.say(current.prompt);
  }, [current]);

  async function choose(choiceId: string) {
    if (!current || feedback || !scenarios) return;
    const choice = current.choices.find((c) => c.id === choiceId);
    setChosenId(choiceId);
    setFeedback(choice?.isBest ? "correct" : "incorrect");
    if (choice?.isBest) mascotRef.current?.praise();
    else mascotRef.current?.encourage();
    const next = [...answers, { scenarioId: current.id, chosenChoiceId: choiceId }];
    setAnswers(next);

    setTimeout(async () => {
      setFeedback(null);
      setChosenId(null);
      if (index + 1 >= scenarios.length) {
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
    }, 1100);
  }

  function playAgain() {
    reshuffleScenarios();
    setIndex(0);
    setAnswers([]);
    setResult(null);
    setBadgeEarned(false);
    setFeedback(null);
    setChosenId(null);
  }

  if (!scenarios) {
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

  const best = current?.choices.find((c) => c.isBest)?.id;

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm font-semibold text-muted-foreground">
        {t("round")} {index + 1} / {scenarios.length}
      </p>

      <Mascot ref={mascotRef} locale={locale} />

      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-4 border-border bg-card px-6 py-6 text-center shadow-md">
        <span className="text-7xl" aria-hidden>
          {current?.emoji}
        </span>
        <p className="text-lg font-bold text-balance">{current?.prompt[locale]}</p>
      </div>

      <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
        {current?.choices.map((choice) => {
          // After a tap: the best choice lights up green, a wrong pick red.
          const state = feedback ? (choice.id === best ? "correct" : choice.id === chosenId ? "incorrect" : null) : null;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={!!feedback}
              onClick={() => choose(choice.id)}
              className={cn(
                "flex min-h-24 items-center gap-3 rounded-3xl border-4 bg-card px-5 py-4 text-left text-base font-bold shadow-sm transition active:scale-95 disabled:cursor-default",
                state === "correct" && "border-success bg-success/10",
                state === "incorrect" && "border-destructive bg-destructive/10",
                !state && "border-border/60 hover:-translate-y-0.5 hover:shadow-md"
              )}
            >
              {choice.emoji && (
                <span className="text-4xl" aria-hidden>
                  {choice.emoji}
                </span>
              )}
              <span className="flex-1 text-balance">{choice.label[locale]}</span>
              {state === "correct" && <Check className="size-7 shrink-0 text-success" />}
              {state === "incorrect" && <X className="size-7 shrink-0 text-destructive" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
