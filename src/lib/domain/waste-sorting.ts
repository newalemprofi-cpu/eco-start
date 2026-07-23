/**
 * EcoGame — waste sorting. The item catalog (and therefore "what's
 * correct") lives only on the server; scoring always happens here, not
 * from a client-submitted score, so a tampered client request can't
 * inflate XP. See src/app/[locale]/app/child/games/waste-sorting/actions.ts.
 */

export const WASTE_BINS = ["paper", "plastic", "glass", "organic"] as const;
export type WasteBin = (typeof WASTE_BINS)[number];

export type WasteItem = {
  id: string;
  emoji: string;
  labels: { kk: string; ru: string; en: string };
  correctBin: WasteBin;
};

export const WASTE_ITEMS: WasteItem[] = [
  { id: "newspaper", emoji: "📰", labels: { kk: "Газет", ru: "Газета", en: "Newspaper" }, correctBin: "paper" },
  { id: "cardboard", emoji: "📦", labels: { kk: "Картон қорап", ru: "Картонная коробка", en: "Cardboard box" }, correctBin: "paper" },
  { id: "bottle-plastic", emoji: "🧴", labels: { kk: "Пластик бөтелке", ru: "Пластиковая бутылка", en: "Plastic bottle" }, correctBin: "plastic" },
  { id: "bag-plastic", emoji: "🛍️", labels: { kk: "Пакет", ru: "Пакет", en: "Plastic bag" }, correctBin: "plastic" },
  { id: "jar-glass", emoji: "🫙", labels: { kk: "Шыны банка", ru: "Стеклянная банка", en: "Glass jar" }, correctBin: "glass" },
  { id: "bottle-glass", emoji: "🍾", labels: { kk: "Шыны бөтелке", ru: "Стеклянная бутылка", en: "Glass bottle" }, correctBin: "glass" },
  { id: "apple-core", emoji: "🍎", labels: { kk: "Алма қалдығы", ru: "Огрызок яблока", en: "Apple core" }, correctBin: "organic" },
  { id: "banana-peel", emoji: "🍌", labels: { kk: "Банан қабығы", ru: "Банановая кожура", en: "Banana peel" }, correctBin: "organic" },
  { id: "leaf", emoji: "🍂", labels: { kk: "Құрғақ жапырақ", ru: "Сухой лист", en: "Dry leaf" }, correctBin: "organic" },
  { id: "can", emoji: "🥫", labels: { kk: "Консерв банкасы", ru: "Консервная банка", en: "Tin can" }, correctBin: "plastic" },
];

export type WasteSortingAnswer = { itemId: string; chosenBin: string };

export type WasteSortingResult = {
  score: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
  perItem: { itemId: string; correct: boolean; correctBin: WasteBin }[];
};

const POINTS_PER_CORRECT = 10;
const XP_PER_CORRECT = 5;

export function scoreWasteSortingAttempt(answers: WasteSortingAnswer[]): WasteSortingResult {
  const perItem = answers.map(({ itemId, chosenBin }) => {
    const item = WASTE_ITEMS.find((i) => i.id === itemId);
    const correctBin = item?.correctBin ?? "organic";
    const correct = Boolean(item) && item!.correctBin === chosenBin;
    return { itemId, correct, correctBin };
  });

  const correctCount = perItem.filter((r) => r.correct).length;

  return {
    score: correctCount * POINTS_PER_CORRECT,
    xpEarned: correctCount * XP_PER_CORRECT,
    correctCount,
    totalCount: answers.length,
    perItem,
  };
}

export function pickRoundItems(seedOffset = 0, count = 6): WasteItem[] {
  // Deterministic-but-varied round selection (rotates through the
  // catalog instead of using Math.random, so a given attempt number
  // always yields the same round — useful for tests/demos).
  const rotated = [...WASTE_ITEMS.slice(seedOffset % WASTE_ITEMS.length), ...WASTE_ITEMS.slice(0, seedOffset % WASTE_ITEMS.length)];
  return rotated.slice(0, count);
}
