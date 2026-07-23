"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/** A draggable version of TapTile's visual language — same size
 * scale, but grabbed and dropped instead of tapped. Used by every
 * "drag the thing onto the zone" game (waste sorting, bee & flowers,
 * river cleanup, animal homes, recycling, puzzle pieces). */
export function DraggableTile({
  id,
  emoji,
  label,
  disabled,
  placed,
  size = "md",
}: {
  id: string;
  emoji: React.ReactNode;
  label?: string;
  disabled?: boolean;
  /** Once an item has been successfully placed, show it "settled" instead of draggable. */
  placed?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: disabled || placed,
  });

  const dims = {
    sm: "size-16 text-3xl",
    md: "size-20 text-4xl sm:size-24",
    lg: "size-24 text-5xl sm:size-28",
  }[size];

  const style: React.CSSProperties = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : {};

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-testid={`draggable-${id}`}
      style={style}
      {...(placed ? {} : listeners)}
      {...(placed ? {} : attributes)}
      className={cn(
        "flex touch-none flex-col items-center justify-center gap-0.5 rounded-3xl border-4 border-border/60 bg-card shadow-md transition-transform",
        dims,
        isDragging && "scale-110 cursor-grabbing opacity-90 shadow-xl",
        !isDragging && !placed && "cursor-grab hover:-translate-y-1 active:scale-95",
        placed && "cursor-default border-success/40 bg-success/10 opacity-70"
      )}
    >
      <span aria-hidden className="leading-none">
        {emoji}
      </span>
      {label && <span className="max-w-full truncate px-1 text-[10px] font-bold text-muted-foreground">{label}</span>}
    </button>
  );
}
