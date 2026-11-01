/**
 * The platform's user-facing name. Internal identifiers (package name,
 * database, tables, cookie name, repo, domain, demo e-mail addresses)
 * intentionally keep "eco-start" — only what people *see* changes.
 */
export const BRAND_NAME = "ЭКО ҚАДАМ";

// Every earlier spelling of the visible name: "Eco Start", "Eco Start AI",
// "Эко Start", "Эко Старт", "ECO START" … A separator is required, so
// e-mail addresses / identifiers like "ecostart.local" or "EcoStart2026"
// are never touched.
const LEGACY_NAME = /(?<![\p{L}\p{N}@._-])(?:eco|эко)[  -]+(?:start|старт)(?:[  ]+ai)?(?![\p{L}\p{N}])/giu;

// Kazakh case endings follow the last sound of the word: "Start" ends in
// a voiceless "т" (→ -қа, -тың, -та…), "ҚАДАМ" in a sonorant "м"
// (→ -ға, -ның, -да…). So «Эко Start»-қа must become «ЭКО ҚАДАМ»-ға.
const SUFFIX_AFTER_M: Record<string, string> = {
  қа: "ға", ке: "ға", ка: "ға",
  тың: "ның", тің: "ның",
  та: "да", те: "да",
  тан: "нан", тен: "нан",
  ты: "ды", ті: "ды",
  пен: "мен", бен: "мен",
};
const LEGACY_WITH_SUFFIX = new RegExp(
  `${LEGACY_NAME.source}([»"']?)-(${Object.keys(SUFFIX_AFTER_M).join("|")})(?![\\p{L}])`,
  "giu"
);

/** Replaces legacy brand spellings in a piece of display text. */
export function rebrandText(text: string): string {
  return text
    .replace(LEGACY_WITH_SUFFIX, (_m, quote: string, suffix: string) => `${BRAND_NAME}${quote}-${SUFFIX_AFTER_M[suffix.toLowerCase()]}`)
    .replace(LEGACY_NAME, BRAND_NAME);
}

/**
 * Same, applied to every string inside a CMS row (localized jsonb
 * content included). Used on *published* CMS reads only — the database
 * keeps whatever an editor typed, so this is display-only, reversible,
 * and needs no data migration.
 */
export function rebrandDeep<T>(value: T): T {
  if (typeof value === "string") return rebrandText(value) as T;
  if (Array.isArray(value)) return value.map((v) => rebrandDeep(v)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrandDeep(v)])) as T;
  }
  return value;
}
