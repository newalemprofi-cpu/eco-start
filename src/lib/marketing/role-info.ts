// Public description of each role card on the homepage ("Тәжірибеден —
// нәтижеге"), shown on /roles/[key]. Only describes what a role can do
// in general — no internal data, routes beyond the role's own home, or
// anything a visitor couldn't learn from a brochure.
import type { ModuleKey } from "@/lib/marketing/module-info";

export const ROLE_KEYS = ["CHILD", "TEACHER", "PARENT", "SCHOOL_ADMIN"] as const;
export type PublicRoleKey = (typeof ROLE_KEYS)[number];

export type RoleInfo = {
  emoji: string;
  name: string;
  summary: string;
  features: string[];
  howTo: string[];
  modules: ModuleKey[];
  loginHint: string;
};

export const ROLE_INFO: Record<PublicRoleKey, RoleInfo> = {
  CHILD: {
    emoji: "🧒",
    name: "Бала",
    summary:
      "3–6 жастағы балаға арналған кабинет: үлкен батырмалар, суреттер және минималды мәтін. Бала оқи алмаса да, суреттерді басу арқылы өзі әрекет жасайды.",
    features: [
      "Эко Зертхана — табиғатты суретке түсіріп тану",
      "Жасыл бөбекжай — өз өсімдігін күту",
      "15 эко-ойын және жетістік белгілері",
      "Тәрбиеші жариялаған тапсырмалар мен зерттеулер",
    ],
    howTo: [
      "Тәрбиешіден жеке кіру кодын және PIN алу",
      "Кіру бетінде кодты және PIN-ді енгізу (ересектің көмегімен)",
      "Басты беттегі үлкен суретті батырмалардан модульді таңдау",
    ],
    modules: ["ecolab", "greenhouse", "game", "media", "research", "passport"],
    loginHint: "Кіру коды мен PIN-ді тәрбиеші береді.",
  },
  TEACHER: {
    emoji: "👩‍🏫",
    name: "Тәрбиеші",
    summary:
      "Тәрбиеші AI арқылы оқу-ойын әрекетін жасайды, оны өз тобына жариялайды, зерттеу жобаларын жүргізеді және топтың дамуын бақылайды.",
    features: [
      "AI оқу-ойын әрекетінің генераторы (3–4, 4–5, 5–6, 6–7 жас)",
      "Материалды топқа жариялау, архивтеу және қалпына келтіру",
      "Эко Зерттеу жобаларын құру және нәтижелерді қарау",
      "Эко Талдау — белсенділік пен прогресс есептері",
    ],
    howTo: [
      "Меңгеруші тіркеген email және құпиясөзбен кіру",
      "AI студиясында тақырып пен жасты таңдап, материал жасау",
      "Материалды тобыңызға жариялау — балалар бірден көреді",
    ],
    modules: ["research", "analytics"],
    loginHint: "Тіркелгіні бөбекжай меңгерушісі ашады.",
  },
  PARENT: {
    emoji: "👨‍👩‍👧",
    name: "Ата-ана",
    summary:
      "Ата-ана баласының бөбекжайдағы экологиялық тәжірибесін бақылайды: белсенділігін, жетістіктерін және үй тапсырмаларын көреді.",
    features: [
      "Баланың апталық белсенділік қорытындысы",
      "Эко Төлқұжат — белгілер мен сертификаттар",
      "Тәрбиеші жариялаған үй тапсырмалары",
    ],
    howTo: [
      "Бөбекжай берген email және құпиясөзбен кіру",
      "Басты бетте баланың көрсеткіштерін қарау",
      "Тапсырмалар бөлімінде үйде бірге орындайтын тапсырманы таңдау",
    ],
    modules: ["family", "passport"],
    loginHint: "Ата-ана тек өз баласының деректерін көреді.",
  },
  SCHOOL_ADMIN: {
    emoji: "🏫",
    name: "Әкімші",
    summary:
      "Бөбекжай меңгерушісі тәрбиешілерді, балаларды және ата-аналарды тіркейді, медиа мазмұнын басқарады және аудит журналын қарайды.",
    features: [
      "Тәрбиеші, бала және ата-ана тіркелгілерін ашу",
      "Топтар мен балаларды бекіту",
      "Медиа мазмұнының көрінуін басқару",
      "Аудит журналы",
    ],
    howTo: [
      "Платформа әкімшісі берген тіркелгімен кіру",
      "Тәрбиешілерді тіркеп, оларды топқа бекіту",
      "Балаларға кіру кодтарын беру",
    ],
    modules: ["analytics", "family"],
    loginHint: "Тіркелгіні платформа әкімшісі ашады.",
  },
};

export function isPublicRoleKey(value: string): value is PublicRoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}
