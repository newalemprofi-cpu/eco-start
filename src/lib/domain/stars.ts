/** Pure — no "use client" — so both server pages (the games hub) and
 * the client StarRating component can call it. */
export function starsForRatio(correct: number, total: number): 1 | 2 | 3 {
  if (total <= 0) return 1;
  const ratio = correct / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}
