"use client";

import * as React from "react";
import { playSound } from "@/lib/sound/game-sounds";
import { cn } from "@/lib/utils";

type Feedback = "correct" | "incorrect" | "selected" | null;

/**
 * The one large tap target every preschool game builds on — emoji-
 * forward, minimal/no text, generous hit area (never smaller than
 * ~84px), a soft tap sound, and a press animation. No game should
 * reach for a plain <button> directly; this is the shared touch
 * target so sizing/feedback stays consistent across all 15 games.
 */
export function TapTile({
  emoji,
  label,
  ariaLabel,
  feedback = null,
  disabled,
  onTap,
  size = "md",
  className,
}: {
  emoji: React.ReactNode;
  label?: string;
  /** For screen readers when there's no visible label (most in-game grids). */
  ariaLabel?: string;
  feedback?: Feedback;
  disabled?: boolean;
  onTap?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = {
    sm: "size-20 text-4xl",
    md: "size-24 text-5xl sm:size-28",
    lg: "size-32 text-6xl sm:size-40",
  }[size];

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      onClick={() => {
        if (disabled) return;
        playSound("tap");
        onTap?.();
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-[2rem] border-4 bg-card shadow-md transition-all duration-150 active:scale-90 disabled:cursor-default",
        dims,
        feedback === "correct" && "border-success bg-success/15",
        feedback === "incorrect" && "border-destructive/60 bg-destructive/10",
        feedback === "selected" && "border-primary bg-primary/15 -translate-y-1",
        !feedback && "border-border/60 hover:-translate-y-1 hover:shadow-lg",
        className
      )}
    >
      <span aria-hidden className="leading-none">
        {emoji}
      </span>
      {label && <span className="max-w-full truncate px-1 text-xs font-bold text-muted-foreground">{label}</span>}
    </button>
  );
}
