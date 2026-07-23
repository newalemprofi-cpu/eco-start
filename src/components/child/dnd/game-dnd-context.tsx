"use client";

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

/**
 * Shared @dnd-kit setup for every drag-based game — PointerSensor
 * covers mouse AND touch with one sensor (no separate touch sensor
 * needed), with a small activation distance so a plain tap on a tile
 * that isn't meant to be dragged yet doesn't misfire as a drag.
 */
export function GameDndContext({
  onDragEnd,
  children,
}: {
  onDragEnd: (event: DragEndEvent) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}
