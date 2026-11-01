// Code-side catalog for "Жасыл бөбекжай" — what a child can plant, how
// it grows and what to do while it grows. Lives in code (not the
// species table) because it is fixed curriculum content with growth
// stages, and greenhouse_entries.plant_key (0014 migration) only stores
// the key. Entries created before that migration have no key and fall
// back to UNKNOWN_PLANT, so their history renders unchanged.
//
// The "picture" for each plant is an emoji: readable by 3-year-olds,
// identical on every device, and no image hosting needed.

export const PLANT_CATEGORIES = ["flowers", "trees", "vegetables", "other"] as const;
export type PlantCategory = (typeof PLANT_CATEGORIES)[number];

export const PLANT_CATEGORY_INFO: Record<PlantCategory, { label: string; emoji: string }> = {
  flowers: { label: "Гүлдер", emoji: "🌸" },
  trees: { label: "Ағаштар", emoji: "🌳" },
  vegetables: { label: "Көкөністер", emoji: "🥕" },
  other: { label: "Басқалар", emoji: "🌵" },
};

export type GrowthStage = { key: string; emoji: string; label: string };
export type CareAction = { emoji: string; label: string };

export type PlantDefinition = {
  key: string;
  category: PlantCategory;
  emoji: string;
  name: string;
  stages: GrowthStage[];
  care: CareAction[];
};

const SEED: GrowthStage = { key: "seed", emoji: "🌰", label: "Тұқым" };
const SPROUT: GrowthStage = { key: "sprout", emoji: "🌱", label: "Өскін" };
const LEAVES: GrowthStage = { key: "leaves", emoji: "🌿", label: "Жапырақ" };
const BLOOM: GrowthStage = { key: "bloom", emoji: "🌼", label: "Гүлдеді" };

const WATER: CareAction = { emoji: "💧", label: "Суару" };
const SUN: CareAction = { emoji: "☀️", label: "Күнге қою" };
const MEASURE: CareAction = { emoji: "📏", label: "Өлшеу" };
const COUNT_LEAVES: CareAction = { emoji: "🍃", label: "Жапырақ санау" };
const WEED: CareAction = { emoji: "🧹", label: "Арамшөп жұлу" };
const PHOTO: CareAction = { emoji: "📷", label: "Суретке түсіру" };

/** Fruiting vegetable: seed → sprout → leaves → flower → harvest. */
function fruiting(key: string, emoji: string, name: string): PlantDefinition {
  return {
    key,
    category: "vegetables",
    emoji,
    name,
    stages: [SEED, SPROUT, LEAVES, BLOOM, { key: "harvest", emoji, label: "Пісті" }],
    care: [WATER, SUN, COUNT_LEAVES, WEED, PHOTO],
  };
}

/** Root/leaf vegetable: no flower stage the child would watch for. */
function rooted(key: string, emoji: string, name: string, harvestLabel = "Жинауға дайын"): PlantDefinition {
  return {
    key,
    category: "vegetables",
    emoji,
    name,
    stages: [SEED, SPROUT, LEAVES, { key: "harvest", emoji, label: harvestLabel }],
    care: [WATER, COUNT_LEAVES, WEED, MEASURE],
  };
}

function flower(key: string, emoji: string, name: string): PlantDefinition {
  return {
    key,
    category: "flowers",
    emoji,
    name,
    stages: [SEED, SPROUT, LEAVES, { key: "bud", emoji: "🫛", label: "Бүршік" }, { key: "bloom", emoji, label: "Гүлдеді" }],
    care: [WATER, SUN, COUNT_LEAVES, PHOTO],
  };
}

function tree(key: string, emoji: string, name: string): PlantDefinition {
  return {
    key,
    category: "trees",
    emoji,
    name,
    stages: [SEED, SPROUT, { key: "sapling", emoji: "🌿", label: "Көшет" }, { key: "tree", emoji, label: "Ағаш" }],
    care: [WATER, SUN, MEASURE, PHOTO],
  };
}

export const PLANT_CATALOG: PlantDefinition[] = [
  // Көкөністер
  fruiting("tomato", "🍅", "Қызанақ"),
  fruiting("cucumber", "🥒", "Қияр"),
  fruiting("pepper", "🫑", "Бұрыш"),
  rooted("carrot", "🥕", "Сәбіз"),
  rooted("onion", "🧅", "Пияз"),
  rooted("potato", "🥔", "Картоп"),
  rooted("cabbage", "🥬", "Қырыққабат", "Басы түйілді"),
  // Гүлдер
  flower("sunflower", "🌻", "Күнбағыс"),
  flower("tulip", "🌷", "Қызғалдақ"),
  flower("chamomile", "🌼", "Түймедақ"),
  flower("rose", "🌹", "Раушан"),
  // Ағаштар
  tree("apple_tree", "🍎", "Алма ағашы"),
  tree("pine", "🌲", "Қарағай"),
  tree("birch", "🌳", "Қайың"),
  // Басқалар
  {
    key: "cactus",
    category: "other",
    emoji: "🌵",
    name: "Кактус",
    stages: [SPROUT, { key: "grown", emoji: "🌵", label: "Өсті" }],
    care: [{ emoji: "💧", label: "Аздап суару" }, SUN, MEASURE],
  },
  {
    key: "bean",
    category: "other",
    emoji: "🫘",
    name: "Бұршақ",
    stages: [SEED, SPROUT, LEAVES, { key: "pods", emoji: "🫛", label: "Бұршаққап" }],
    care: [WATER, SUN, MEASURE, COUNT_LEAVES],
  },
  {
    key: "wheat",
    category: "other",
    emoji: "🌾",
    name: "Бидай",
    stages: [SEED, SPROUT, { key: "ear", emoji: "🌾", label: "Масақ" }],
    care: [WATER, SUN, MEASURE],
  },
  {
    key: "clover",
    category: "other",
    emoji: "🍀",
    name: "Беде",
    stages: [SEED, SPROUT, { key: "leaves", emoji: "🍀", label: "Жапырақ" }],
    care: [WATER, COUNT_LEAVES, PHOTO],
  },
];

/** Plants added before the catalog existed (plant_key IS NULL). */
export const UNKNOWN_PLANT: PlantDefinition = {
  key: "unknown",
  category: "other",
  emoji: "🪴",
  name: "Өсімдік",
  stages: [SEED, SPROUT, LEAVES, BLOOM],
  care: [WATER, SUN, MEASURE, COUNT_LEAVES],
};

export const PLANT_KEYS = PLANT_CATALOG.map((p) => p.key) as [string, ...string[]];

const BY_KEY = new Map(PLANT_CATALOG.map((p) => [p.key, p]));

export function getPlant(key: string | null | undefined): PlantDefinition {
  return (key && BY_KEY.get(key)) || UNKNOWN_PLANT;
}

export function plantsInCategory(category: PlantCategory): PlantDefinition[] {
  return PLANT_CATALOG.filter((p) => p.category === category);
}

/** Every stage key any plant uses — the server-side whitelist for growth_logs.stage. */
export const ALL_STAGE_KEYS = [
  ...new Set([...PLANT_CATALOG, UNKNOWN_PLANT].flatMap((p) => p.stages.map((s) => s.key))),
] as [string, ...string[]];

/** 3-4 year olds count up to 5; older children get up to 10 leaves. */
export function maxLeavesForAge(isYoungest: boolean): number {
  return isYoungest ? 5 : 10;
}
