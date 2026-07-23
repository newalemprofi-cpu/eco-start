export type Locale = "kk" | "ru" | "en";
export type Localized = { kk: string; ru: string; en: string };

/**
 * Short, spoken-style phrases the mascot "says" (today: a speech
 * bubble + a synthesized chime; see docs on the voice hook below for
 * how real recorded/AI voice slots in later without touching call
 * sites). Every phrase is one short sentence — preschoolers can't read
 * paragraphs, and this is a fallback channel anyway, not the primary
 * one (sound + mascot expression carry the meaning).
 */
export const MASCOT_PHRASES = {
  welcome: { kk: "Ойнайық!", ru: "Давай играть!", en: "Let's play!" },
  praise1: { kk: "Жарайсың!", ru: "Молодец!", en: "Great job!" },
  praise2: { kk: "Өте жақсы!", ru: "Отлично!", en: "Awesome!" },
  praise3: { kk: "Керемет!", ru: "Супер!", en: "Wonderful!" },
  encourage1: { kk: "Тағы байқап көрейік 😊", ru: "Давай попробуем ещё раз 😊", en: "Let's try again 😊" },
  encourage2: { kk: "Жақсы байқадың!", ru: "Хорошая попытка!", en: "Nice try!" },
  celebrate: { kk: "Сен жұлдызсың! ⭐", ru: "Ты звезда! ⭐", en: "You're a star! ⭐" },
} as const satisfies Record<string, Localized>;

export type MascotPhraseKey = keyof typeof MASCOT_PHRASES;

const PRAISE_KEYS: MascotPhraseKey[] = ["praise1", "praise2", "praise3"];
const ENCOURAGE_KEYS: MascotPhraseKey[] = ["encourage1", "encourage2"];

export function randomPraise(): Localized {
  return MASCOT_PHRASES[PRAISE_KEYS[Math.floor(Math.random() * PRAISE_KEYS.length)]];
}

export function randomEncourage(): Localized {
  return MASCOT_PHRASES[ENCOURAGE_KEYS[Math.floor(Math.random() * ENCOURAGE_KEYS.length)]];
}
