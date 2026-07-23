/** Tiny deterministic string hash (FNV-1a) — used to make the mock AI
 * provider's "random" choices reproducible for the same input, so demos
 * and tests are stable instead of flaky. */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function pickDeterministic<T>(items: readonly T[], seed: string): T {
  const idx = stableHash(seed) % items.length;
  return items[idx];
}

/** Deterministic pseudo-float in [min, max) derived from seed. */
export function stableFloat(seed: string, min: number, max: number): number {
  const h = stableHash(seed) / 0xffffffff;
  return min + h * (max - min);
}
