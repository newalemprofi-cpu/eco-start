"use client";

import * as React from "react";

/**
 * `useState(() => shuffle(items))` looks safe but isn't: the lazy
 * initializer runs once during SSR (producing order A) and once more
 * on the client's first render before hydration reconciles (producing
 * order B, since Math.random() differs) — React then throws a
 * hydration mismatch and re-renders the whole tree client-side. Every
 * game that shuffles its round order needs the shuffle to happen only
 * after mount, returning null until then (see the original
 * WasteSortingGame for the pattern this generalizes). The returned
 * `reshuffle` also covers "play again" — that one's safe to call from
 * an event handler since it never runs during render.
 */
export function useShuffledOnMount<T>(items: T[]): [T[] | null, () => void] {
  const [shuffled, setShuffled] = React.useState<T[] | null>(null);
  const itemsRef = React.useRef(items);
  React.useEffect(() => {
    itemsRef.current = items;
  });

  const reshuffle = React.useCallback(() => {
    setShuffled([...itemsRef.current].sort(() => Math.random() - 0.5));
  }, []);

  React.useEffect(() => {
    reshuffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [shuffled, reshuffle];
}
