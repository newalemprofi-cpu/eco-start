"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

/** A large drop target — a bin, a home, a basket, a puzzle slot.
 * Highlights while something is dragged over it so the child gets
 * immediate visual feedback before even releasing. */
export function DroppableZone({
  id,
  emoji,
  label,
  color,
  feedback,
  children,
  className,
}: {
  id: string;
  emoji?: React.ReactNode;
  label?: string;
  color?: string;
  feedback?: "correct" | "incorrect" | null;
  children?: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      data-testid={`dropzone-${id}`}
      className={cn(
        "flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-4 border-dashed p-3 transition-all sm:min-h-32",
        isOver && "scale-105 border-solid",
        feedback === "correct" && "border-success bg-success/15",
        feedback === "incorrect" && "border-destructive/60 bg-destructive/10",
        !feedback && !isOver && "border-border/60 bg-muted/30",
        !feedback && isOver && "border-primary bg-primary/10",
        className
      )}
      style={color && !feedback ? { borderColor: isOver ? color : undefined } : undefined}
    >
      {emoji && (
        <span
          className="flex size-12 items-center justify-center rounded-2xl text-2xl text-white shadow-sm sm:size-14 sm:text-3xl"
          style={{ backgroundColor: color ?? "var(--module-game)" }}
          aria-hidden
        >
          {emoji}
        </span>
      )}
      {label && <span className="text-xs font-bold text-muted-foreground">{label}</span>}
      {children}
    </div>
  );
}
