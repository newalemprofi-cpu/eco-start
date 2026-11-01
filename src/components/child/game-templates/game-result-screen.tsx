"use client";

import * as React from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { playSound } from "@/lib/sound/game-sounds";
import type { Locale } from "@/lib/sound/mascot-phrases";
import { Mascot, type MascotHandle } from "@/components/child/mascot";
import { Confetti } from "@/components/child/confetti";
import { StarRating } from "@/components/child/star-rating";
import { starsForRatio } from "@/lib/domain/stars";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PLAY_AGAIN_LABEL: Record<Locale, string> = {
  kk: "Тағы ойнау",
  ru: "Играть снова",
  en: "Play again",
};

const XP_ALREADY_EARNED: Record<Locale, string> = {
  kk: "Жарайсың! Бұл ойынның XP-ін бұрын жинап қойдың ⭐",
  ru: "Молодец! XP за эту игру уже получен ⭐",
  en: "Well done! You already collected this game's XP ⭐",
};

const SAVE_FAILED: Record<Locale, string> = {
  kk: "Нәтиже сақталмады. Қайта ойнап көрейік!",
  ru: "Результат не сохранился. Давай ещё раз!",
  en: "The result wasn't saved. Let's try again!",
};

/**
 * Every game ends here — no reading required: stars carry the result,
 * a mascot celebration + confetti carry the reward, and "play again"
 * is a single big tap. There is no failure state; `result` is only
 * ever shown once the round is genuinely complete.
 */
export function GameResultScreen({
  locale,
  submitting,
  result,
  badgeEarned,
  onPlayAgain,
}: {
  locale: Locale;
  submitting: boolean;
  result: { correctCount: number; totalCount: number; xpEarned: number } | null;
  badgeEarned: boolean;
  onPlayAgain: () => void;
}) {
  const mascotRef = React.useRef<MascotHandle>(null);
  const [confettiKey, setConfettiKey] = React.useState(0);
  const celebratedRef = React.useRef(false);

  React.useEffect(() => {
    if (!result || celebratedRef.current) return;
    celebratedRef.current = true;
    mascotRef.current?.celebrate();
    setConfettiKey((k) => k + 1);
    if (badgeEarned) {
      const t = setTimeout(() => playSound("catch"), 500);
      return () => clearTimeout(t);
    }
  }, [result, badgeEarned]);

  const stars = result ? starsForRatio(result.correctCount, result.totalCount) : 1;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
        {submitting ? (
          <Loader2 className="size-10 animate-spin text-primary" />
        ) : result ? (
          <>
            <Confetti fireKey={confettiKey} />
            <Mascot ref={mascotRef} locale={locale} size="lg" />
            <StarRating earned={stars} />
            <p className="text-3xl font-extrabold text-primary">+{result.xpEarned} XP</p>
            {result.xpEarned === 0 && result.correctCount > 0 && (
              <p className="max-w-xs text-sm font-semibold text-muted-foreground">{XP_ALREADY_EARNED[locale]}</p>
            )}
            {badgeEarned && (
              <div className="flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-bold text-warning">
                <Sparkles className="size-4" />
                🏅
              </div>
            )}
            <Button
              size="lg"
              onClick={onPlayAgain}
              aria-label={PLAY_AGAIN_LABEL[locale]}
              className="mt-2 h-16 gap-2 rounded-full px-8 text-lg"
            >
              <RotateCcw className="size-6" />
              🔁
            </Button>
          </>
        ) : (
          // Submit failed (network/session) — never leave an empty card.
          <>
            <span className="text-6xl" aria-hidden>
              🙈
            </span>
            <p className="max-w-xs text-sm font-semibold text-muted-foreground">{SAVE_FAILED[locale]}</p>
            <Button
              size="lg"
              onClick={onPlayAgain}
              aria-label={PLAY_AGAIN_LABEL[locale]}
              className="h-16 gap-2 rounded-full px-8 text-lg"
            >
              <RotateCcw className="size-6" />
              🔁
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
