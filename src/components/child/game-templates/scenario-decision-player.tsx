"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { submitGenericGameRound } from "@/app/[locale]/app/child/games/[gameKey]/actions";
import type { ScenarioDecisionAnswer, ScenarioDecisionConfig } from "@/lib/domain/game-templates/types";
import { GameResultScreen } from "@/components/child/game-templates/game-result-screen";
import { cn } from "@/lib/utils";

type Locale = "kk" | "ru" | "en";

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

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
  const [scenarios, setScenarios] = React.useState(() => shuffled(config.scenarios));
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<ScenarioDecisionAnswer[]>([]);
  const [feedback, setFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [badgeEarned, setBadgeEarned] = React.useState(false);
  const [result, setResult] = React.useState<{ correctCount: number; totalCount: number; xpEarned: number } | null>(null);

  const current = scenarios[index];
  const done = index >= scenarios.length;

  async function choose(choiceId: string) {
    if (!current || feedback) return;
    const choice = current.choices.find((c) => c.id === choiceId);
    setFeedback(choice?.isBest ? "correct" : "incorrect");
    const next = [...answers, { scenarioId: current.id, chosenChoiceId: choiceId }];
    setAnswers(next);

    setTimeout(async () => {
      setFeedback(null);
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
    }, 700);
  }

  function playAgain() {
    setScenarios(shuffled(config.scenarios));
    setIndex(0);
    setAnswers([]);
    setResult(null);
    setBadgeEarned(false);
    setFeedback(null);
  }

  if (done) {
    return (
      <GameResultScreen locale={locale} submitting={submitting} result={result} badgeEarned={badgeEarned} onPlayAgain={playAgain} />
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm font-semibold text-muted-foreground">
        {t("round")} {index + 1} / {scenarios.length}
      </p>

      <div
        className={cn(
          "flex min-h-40 w-full max-w-md flex-col items-center justify-center gap-3 rounded-3xl border-4 px-6 py-8 text-center shadow-md transition sm:min-h-48",
          feedback === "correct" && "border-success bg-success/10",
          feedback === "incorrect" && "border-destructive bg-destructive/10",
          !feedback && "border-border bg-card"
        )}
      >
        {feedback === "correct" ? (
          <Check className="size-14 text-success" />
        ) : feedback === "incorrect" ? (
          <X className="size-14 text-destructive" />
        ) : (
          <>
            <span className="text-6xl">{current?.emoji}</span>
            <p className="text-lg font-semibold text-balance">{current?.prompt[locale]}</p>
          </>
        )}
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        {current?.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={!!feedback}
            onClick={() => choose(choice.id)}
            className="rounded-2xl border border-border/60 bg-card px-5 py-4 text-left text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
          >
            {choice.label[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}
