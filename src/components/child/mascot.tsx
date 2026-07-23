"use client";

import * as React from "react";
import { playSound } from "@/lib/sound/game-sounds";
import { randomEncourage, randomPraise, type Locale, type Localized } from "@/lib/sound/mascot-phrases";
import { cn } from "@/lib/utils";

type Mood = "idle" | "happy" | "thinking" | "celebrating";

const MOOD_FACE: Record<Mood, string> = {
  idle: "🦉",
  happy: "🤩",
  thinking: "🦉",
  celebrating: "🥳",
};

export type MascotHandle = {
  /** Custom per-game instruction line, e.g. "Which bin does this go in?" */
  say: (text: Localized) => void;
  /** A correct-answer moment: random cheerful phrase + success chime. */
  praise: () => void;
  /** A wrong-answer moment: never framed as failure, just "try again". */
  encourage: () => void;
  /** Whole-game-complete moment: bigger phrase + celebration chime. */
  celebrate: () => void;
  clear: () => void;
};

export const Mascot = React.forwardRef<MascotHandle, { locale: Locale; size?: "md" | "lg"; className?: string }>(
  function Mascot({ locale, size = "md", className }, ref) {
    const [text, setText] = React.useState<string | null>(null);
    const [mood, setMood] = React.useState<Mood>("idle");
    const [bounceKey, setBounceKey] = React.useState(0);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = React.useCallback((localized: Localized, nextMood: Mood, durationMs: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setText(localized[locale]);
      setMood(nextMood);
      setBounceKey((k) => k + 1);
      timeoutRef.current = setTimeout(() => {
        setMood("idle");
      }, durationMs);
    }, [locale]);

    React.useImperativeHandle(ref, () => ({
      say: (localized) => {
        show(localized, "thinking", 3200);
      },
      praise: () => {
        playSound("success");
        show(randomPraise(), "happy", 1800);
      },
      encourage: () => {
        playSound("retry");
        show(randomEncourage(), "thinking", 1800);
      },
      celebrate: () => {
        playSound("celebrate");
        show({ kk: "Сен жұлдызсың! ⭐", ru: "Ты звезда! ⭐", en: "You're a star! ⭐" }, "celebrating", 3000);
      },
      clear: () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setText(null);
        setMood("idle");
      },
    }), [show]);

    React.useEffect(() => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const dims = size === "lg" ? "text-7xl" : "text-5xl";

    return (
      <div className={cn("flex flex-col items-center gap-1.5", className)}>
        {text && (
          <div
            key={bounceKey}
            className="animate-in fade-in zoom-in-95 slide-in-from-bottom-1 max-w-56 rounded-3xl rounded-bl-md bg-card px-4 py-2 text-center text-sm font-bold shadow-md ring-1 ring-border/60 duration-300"
          >
            {text}
          </div>
        )}
        <span
          key={`face-${bounceKey}`}
          className={cn(
            dims,
            "select-none drop-shadow-sm",
            mood === "celebrating" && "animate-bounce",
            mood === "happy" && "animate-in zoom-in-125 duration-300"
          )}
          aria-hidden
        >
          {MOOD_FACE[mood]}
        </span>
      </div>
    );
  }
);
