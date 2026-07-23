/**
 * Content for the 14 non-waste-sorting EcoGame games, redesigned for
 * preschoolers (4-6): every round is picture-first, one short mascot
 * phrase at most, and every template either can't be answered wrong
 * (nurture) or lets a wrong drop bounce back instead of failing
 * (drag_sort / drag_collect / puzzle_assemble — see the "settle"
 * family note in src/lib/domain/game-templates/types.ts).
 *
 * Standalone module, like seed.ts itself — no src/@ imports, types
 * are local re-declarations of src/lib/domain/game-templates/types.ts.
 */

type Localized = { kk: string; ru: string; en: string };

export type GameSeed = {
  key: string;
  title: Localized;
  description: Localized;
  icon: string;
  color: string;
  difficulty: "easy" | "medium" | "hard";
  ageMin: number;
  ageMax: number;
  xpReward: number;
  badgeKey: string;
  template:
    | "drag_sort"
    | "quiz_match"
    | "click_target"
    | "sequence_order"
    | "nurture"
    | "drag_collect"
    | "puzzle_assemble"
    | "sound_match"
    | "catch";
  config: unknown;
  order: number;
};

export type AchievementSeed = {
  key: string;
  title: Localized;
  description: Localized;
  icon: string;
  xpReward: number;
};

const COLORS = {
  ecolab: "var(--module-ecolab)",
  greenhouse: "var(--module-greenhouse)",
  game: "var(--module-game)",
  media: "var(--module-media)",
  research: "var(--module-research)",
  passport: "var(--module-passport)",
  family: "var(--module-family)",
  analytics: "var(--module-analytics)",
};

const EMPTY: Localized = { kk: "", ru: "", en: "" };

export const ECOGAMES: GameSeed[] = [
  // 2. Тұқым отырғыз — plant a seed, tap the growing steps in order
  {
    key: "plant-a-tree",
    title: { kk: "Тұқым отырғыз", ru: "Посади семечко", en: "Plant a Seed" },
    description: { kk: "Ретімен бас та, гүл өсір!", ru: "Нажимай по порядку и вырасти цветок!", en: "Tap in order and grow a flower!" },
    icon: "Sprout",
    color: COLORS.greenhouse,
    difficulty: "easy",
    ageMin: 4,
    ageMax: 5,
    xpReward: 20,
    badgeKey: "seed_planter",
    template: "sequence_order",
    order: 1,
    config: {
      sequences: [
        {
          id: "grow",
          prompt: { kk: "Ретімен бас!", ru: "Нажимай по порядку!", en: "Tap in order!" },
          steps: [
            { id: "soil", emoji: "🟤", label: { kk: "Топырақ", ru: "Земля", en: "Soil" } },
            { id: "seed", emoji: "🌰", label: { kk: "Тұқым", ru: "Семечко", en: "Seed" } },
            { id: "water", emoji: "💧", label: { kk: "Су", ru: "Вода", en: "Water" } },
            { id: "sun", emoji: "☀️", label: { kk: "Күн", ru: "Солнце", en: "Sun" } },
            { id: "flower", emoji: "🌸", label: { kk: "Гүл", ru: "Цветок", en: "Flower" } },
          ],
        },
      ],
    },
  },

  // 3. Гүлді суар — tap the watering can, flower gets happier, butterflies appear
  {
    key: "water-the-flower",
    title: { kk: "Гүлді суар", ru: "Полей цветок", en: "Water the Flower" },
    description: { kk: "Суарып, гүлді қуантайық!", ru: "Полей и порадуй цветок!", en: "Water it and make it happy!" },
    icon: "Droplets",
    color: COLORS.family,
    difficulty: "easy",
    ageMin: 4,
    ageMax: 5,
    xpReward: 15,
    badgeKey: "flower_waterer",
    template: "nurture",
    order: 2,
    config: {
      stages: ["🥀", "🌱", "🌿", "🌷", "🌸"],
      actionEmoji: "💧",
      celebrationEmoji: "🦋",
    },
  },

  // 4. Ағаш өсір — tap tree, water, watch it grow, birds arrive
  {
    key: "grow-a-tree",
    title: { kk: "Ағаш өсір", ru: "Вырасти дерево", en: "Grow a Tree" },
    description: { kk: "Суарып, ағашты өсірейік!", ru: "Полей и вырасти дерево!", en: "Water it and watch it grow!" },
    icon: "TreePine",
    color: COLORS.greenhouse,
    difficulty: "easy",
    ageMin: 4,
    ageMax: 5,
    xpReward: 15,
    badgeKey: "tree_grower",
    template: "nurture",
    order: 3,
    config: {
      stages: ["🌰", "🌱", "🌿", "🌳"],
      actionEmoji: "💧",
      celebrationEmoji: "🐦",
    },
  },

  // 5. Ара гүл іздейді — drag the flowers into the bee's basket
  {
    key: "help-the-bees",
    title: { kk: "Араға көмектес", ru: "Помоги пчеле", en: "Help the Bee" },
    description: { kk: "Гүлдерді араға апар!", ru: "Отнеси цветы пчеле!", en: "Bring the flowers to the bee!" },
    icon: "Bug",
    color: COLORS.passport,
    difficulty: "medium",
    ageMin: 5,
    ageMax: 6,
    xpReward: 25,
    badgeKey: "bee_friend",
    template: "drag_collect",
    order: 4,
    config: {
      zoneEmoji: "🐝",
      zoneColor: "#f59e0b",
      roundSize: 4,
      items: [
        { id: "tulip", emoji: "🌷", label: EMPTY, isTarget: true },
        { id: "sunflower", emoji: "🌻", label: EMPTY, isTarget: true },
        { id: "daisy", emoji: "🌼", label: EMPTY, isTarget: true },
        { id: "hibiscus", emoji: "🌺", label: EMPTY, isTarget: true },
        { id: "rose", emoji: "🌹", label: EMPTY, isTarget: true },
        { id: "rock", emoji: "🪨", label: EMPTY, isTarget: false },
        { id: "shoe", emoji: "👟", label: EMPTY, isTarget: false },
        { id: "car", emoji: "🚗", label: EMPTY, isTarget: false },
      ],
    },
  },

  // 6. Өзенді тазала — drag the trash out of the river, leave fish/plants alone
  {
    key: "clean-the-river",
    title: { kk: "Өзенді тазала", ru: "Очисти реку", en: "Clean the River" },
    description: { kk: "Қоқысты алып таста!", ru: "Убери мусор!", en: "Take out the trash!" },
    icon: "Waves",
    color: COLORS.research,
    difficulty: "medium",
    ageMin: 5,
    ageMax: 6,
    xpReward: 25,
    badgeKey: "river_guardian",
    template: "drag_collect",
    order: 5,
    config: {
      zoneEmoji: "🗑️",
      zoneColor: "#71717a",
      roundSize: 4,
      items: [
        { id: "bottle", emoji: "🍾", label: EMPTY, isTarget: true },
        { id: "bag", emoji: "🛍️", label: EMPTY, isTarget: true },
        { id: "can", emoji: "🥫", label: EMPTY, isTarget: true },
        { id: "tire", emoji: "🛞", label: EMPTY, isTarget: true },
        { id: "cup", emoji: "🥤", label: EMPTY, isTarget: true },
        { id: "fish", emoji: "🐟", label: EMPTY, isTarget: false },
        { id: "duck", emoji: "🦆", label: EMPTY, isTarget: false },
        { id: "lily", emoji: "🌸", label: EMPTY, isTarget: false },
      ],
    },
  },

  // 7. Жануарды үйіне апар — drag each animal to its home
  {
    key: "animal-homes",
    title: { kk: "Үйіне апар", ru: "Отнеси домой", en: "Animal Homes" },
    description: { kk: "Жануарды үйіне апар!", ru: "Отнеси животное домой!", en: "Bring each animal home!" },
    icon: "PawPrint",
    color: COLORS.media,
    difficulty: "medium",
    ageMin: 5,
    ageMax: 6,
    xpReward: 25,
    badgeKey: "animal_helper",
    template: "drag_sort",
    order: 6,
    config: {
      roundSize: 4,
      categories: [
        { id: "forest", label: { kk: "Орман", ru: "Лес", en: "Forest" }, color: "#16a34a", emoji: "🌳" },
        { id: "water", label: { kk: "Су", ru: "Вода", en: "Water" }, color: "#0ea5e9", emoji: "🌊" },
        { id: "nest", label: { kk: "Ұя", ru: "Гнездо", en: "Nest" }, color: "#a16207", emoji: "🪺" },
        { id: "desert", label: { kk: "Шөл", ru: "Пустыня", en: "Desert" }, color: "#eab308", emoji: "🏜️" },
      ],
      items: [
        { id: "rabbit", emoji: "🐰", label: EMPTY, correctCategoryId: "forest" },
        { id: "fox", emoji: "🦊", label: EMPTY, correctCategoryId: "forest" },
        { id: "fish", emoji: "🐠", label: EMPTY, correctCategoryId: "water" },
        { id: "turtle", emoji: "🐢", label: EMPTY, correctCategoryId: "water" },
        { id: "bird", emoji: "🐦", label: EMPTY, correctCategoryId: "nest" },
        { id: "chick", emoji: "🐤", label: EMPTY, correctCategoryId: "nest" },
        { id: "camel", emoji: "🐫", label: EMPTY, correctCategoryId: "desert" },
        { id: "lizard", emoji: "🦎", label: EMPTY, correctCategoryId: "desert" },
      ],
    },
  },

  // 8. Өсімдікке не керек? — tap what a plant needs (pictures only)
  {
    key: "plant-needs",
    title: { kk: "Өсімдікке не керек?", ru: "Что нужно растению?", en: "What Does a Plant Need?" },
    description: { kk: "Керегін тап!", ru: "Найди нужное!", en: "Find what it needs!" },
    icon: "Sprout",
    color: COLORS.greenhouse,
    difficulty: "easy",
    ageMin: 4,
    ageMax: 5,
    xpReward: 20,
    badgeKey: "plant_helper",
    template: "quiz_match",
    order: 7,
    config: {
      questions: [
        {
          id: "q1",
          emoji: "🌱",
          prompt: EMPTY,
          options: [
            { id: "sun", emoji: "☀️", label: EMPTY },
            { id: "ice", emoji: "🧊", label: EMPTY },
          ],
          correctOptionId: "sun",
        },
        {
          id: "q2",
          emoji: "🌱",
          prompt: EMPTY,
          options: [
            { id: "fire", emoji: "🔥", label: EMPTY },
            { id: "water", emoji: "💧", label: EMPTY },
          ],
          correctOptionId: "water",
        },
        {
          id: "q3",
          emoji: "🌱",
          prompt: EMPTY,
          options: [
            { id: "sun2", emoji: "☀️", label: EMPTY },
            { id: "fire2", emoji: "🔥", label: EMPTY },
          ],
          correctOptionId: "sun2",
        },
      ],
    },
  },

  // 9. Жемісті жина — catch the fruit, let the trash pass
  {
    key: "catch-fruits",
    title: { kk: "Жемісті жина", ru: "Собери фрукты", en: "Catch the Fruit" },
    description: { kk: "Жемісті ұста!", ru: "Лови фрукты!", en: "Catch the fruit!" },
    icon: "Sparkles",
    color: COLORS.passport,
    difficulty: "medium",
    ageMin: 5,
    ageMax: 6,
    xpReward: 25,
    badgeKey: "fruit_collector",
    template: "catch",
    order: 8,
    config: {
      showMs: 1700,
      items: [
        { id: "apple", emoji: "🍎", isGood: true },
        { id: "banana", emoji: "🍌", isGood: true },
        { id: "grapes", emoji: "🍇", isGood: true },
        { id: "trash1", emoji: "🗑️", isGood: false },
        { id: "strawberry", emoji: "🍓", isGood: true },
        { id: "can", emoji: "🥫", isGood: false },
        { id: "watermelon", emoji: "🍉", isGood: true },
        { id: "trash2", emoji: "🧦", isGood: false },
      ],
    },
  },

  // 10. Түстерді тап — tap only the matching color
  {
    key: "color-hunt",
    title: { kk: "Түстерді тап", ru: "Найди цвет", en: "Color Hunt" },
    description: { kk: "Дұрыс түсті тап!", ru: "Найди нужный цвет!", en: "Find the right color!" },
    icon: "Flower2",
    color: COLORS.ecolab,
    difficulty: "easy",
    ageMin: 4,
    ageMax: 5,
    xpReward: 20,
    badgeKey: "color_spotter",
    template: "click_target",
    order: 9,
    config: {
      rounds: [
        {
          id: "green",
          prompt: EMPTY,
          items: [
            { id: "leaf1", emoji: "🍃", label: EMPTY, isTarget: true },
            { id: "leaf2", emoji: "🌿", label: EMPTY, isTarget: true },
            { id: "apple", emoji: "🍎", label: EMPTY, isTarget: false },
            { id: "leaf3", emoji: "☘️", label: EMPTY, isTarget: true },
            { id: "sun", emoji: "☀️", label: EMPTY, isTarget: false },
          ],
        },
        {
          id: "yellow",
          prompt: EMPTY,
          items: [
            { id: "sunflower", emoji: "🌻", label: EMPTY, isTarget: true },
            { id: "banana", emoji: "🍌", label: EMPTY, isTarget: true },
            { id: "grapes", emoji: "🍇", label: EMPTY, isTarget: false },
            { id: "lemon", emoji: "🍋", label: EMPTY, isTarget: true },
            { id: "leaf", emoji: "🍃", label: EMPTY, isTarget: false },
          ],
        },
        {
          id: "red",
          prompt: EMPTY,
          items: [
            { id: "apple2", emoji: "🍎", label: EMPTY, isTarget: true },
            { id: "strawberry", emoji: "🍓", label: EMPTY, isTarget: true },
            { id: "banana2", emoji: "🍌", label: EMPTY, isTarget: false },
            { id: "cherry", emoji: "🍒", label: EMPTY, isTarget: true },
            { id: "grapes2", emoji: "🍇", label: EMPTY, isTarget: false },
          ],
        },
      ],
    },
  },

  // 11. Қайта өңдеу — move paper, plastic, glass (very simple)
  {
    key: "recycling-factory",
    title: { kk: "Қайта өңдеу", ru: "Переработка", en: "Recycling" },
    description: { kk: "Дұрыс жәшікке сал!", ru: "Положи в нужный ящик!", en: "Put it in the right box!" },
    icon: "Factory",
    color: COLORS.family,
    difficulty: "medium",
    ageMin: 5,
    ageMax: 6,
    xpReward: 25,
    badgeKey: "recycling_master",
    template: "drag_sort",
    order: 10,
    config: {
      roundSize: 4,
      categories: [
        { id: "paper", label: { kk: "Қағаз", ru: "Бумага", en: "Paper" }, color: "#2563eb", emoji: "📄" },
        { id: "plastic", label: { kk: "Пластик", ru: "Пластик", en: "Plastic" }, color: "#f59e0b", emoji: "♻️" },
        { id: "glass", label: { kk: "Шыны", ru: "Стекло", en: "Glass" }, color: "#10b981", emoji: "🫙" },
      ],
      items: [
        { id: "box", emoji: "📦", label: EMPTY, correctCategoryId: "paper" },
        { id: "newspaper", emoji: "📰", label: EMPTY, correctCategoryId: "paper" },
        { id: "bottle", emoji: "🧴", label: EMPTY, correctCategoryId: "plastic" },
        { id: "toy", emoji: "🧸", label: EMPTY, correctCategoryId: "plastic" },
        { id: "jar", emoji: "🫙", label: EMPTY, correctCategoryId: "glass" },
        { id: "glassbottle", emoji: "🍾", label: EMPTY, correctCategoryId: "glass" },
      ],
    },
  },

  // 12. Табиғат пазлы — assemble a 4-piece nature scene
  {
    key: "nature-puzzle",
    title: { kk: "Табиғат пазлы", ru: "Пазл природы", en: "Nature Puzzle" },
    description: { kk: "Суретті құрастыр!", ru: "Собери картинку!", en: "Put the picture together!" },
    icon: "Puzzle",
    color: COLORS.research,
    difficulty: "medium",
    ageMin: 5,
    ageMax: 6,
    xpReward: 25,
    badgeKey: "puzzle_master",
    template: "puzzle_assemble",
    order: 11,
    config: {
      slots: [
        { id: "sky", emoji: "☁️" },
        { id: "sun", emoji: "☀️" },
        { id: "tree", emoji: "🌳" },
        { id: "grass", emoji: "🌱" },
      ],
      pieces: [
        { id: "p-sky", emoji: "☁️", slotId: "sky" },
        { id: "p-sun", emoji: "☀️", slotId: "sun" },
        { id: "p-tree", emoji: "🌳", slotId: "tree" },
        { id: "p-grass", emoji: "🌱", slotId: "grass" },
      ],
    },
  },

  // 13. Табиғат дыбыстары — play a sound, tap the matching picture
  {
    key: "nature-sounds",
    title: { kk: "Табиғат дыбыстары", ru: "Звуки природы", en: "Nature Sounds" },
    description: { kk: "Тыңдап, тап!", ru: "Послушай и найди!", en: "Listen and find it!" },
    icon: "Music2",
    color: COLORS.analytics,
    difficulty: "medium",
    ageMin: 5,
    ageMax: 6,
    xpReward: 25,
    badgeKey: "sound_explorer",
    template: "sound_match",
    order: 12,
    config: {
      rounds: [
        {
          id: "bird",
          sound: "bird",
          correctOptionId: "bird",
          options: [
            { id: "bird", emoji: "🐦", label: EMPTY },
            { id: "fish", emoji: "🐟", label: EMPTY },
            { id: "car", emoji: "🚗", label: EMPTY },
          ],
        },
        {
          id: "rain",
          sound: "rain",
          correctOptionId: "rain",
          options: [
            { id: "rain", emoji: "🌧️", label: EMPTY },
            { id: "sun", emoji: "☀️", label: EMPTY },
            { id: "fire", emoji: "🔥", label: EMPTY },
          ],
        },
        {
          id: "wind",
          sound: "wind",
          correctOptionId: "wind",
          options: [
            { id: "wind", emoji: "🍃", label: EMPTY },
            { id: "rock", emoji: "🪨", label: EMPTY },
            { id: "fish2", emoji: "🐟", label: EMPTY },
          ],
        },
        {
          id: "bee",
          sound: "bee",
          correctOptionId: "bee",
          options: [
            { id: "bee", emoji: "🐝", label: EMPTY },
            { id: "butterfly", emoji: "🦋", label: EMPTY },
            { id: "bird2", emoji: "🐦", label: EMPTY },
          ],
        },
      ],
    },
  },

  // 14. Артық затты тап — tap the odd one out
  {
    key: "odd-one-out",
    title: { kk: "Артық затты тап", ru: "Найди лишнее", en: "Find the Odd One Out" },
    description: { kk: "Ұқсамайтынды тап!", ru: "Найди непохожее!", en: "Find the one that's different!" },
    icon: "Sparkles",
    color: COLORS.game,
    difficulty: "easy",
    ageMin: 4,
    ageMax: 5,
    xpReward: 20,
    badgeKey: "sharp_eyes",
    template: "click_target",
    order: 13,
    config: {
      rounds: [
        {
          id: "trees",
          prompt: EMPTY,
          items: [
            { id: "tree1", emoji: "🌳", label: EMPTY, isTarget: false },
            { id: "tree2", emoji: "🌳", label: EMPTY, isTarget: false },
            { id: "car", emoji: "🚗", label: EMPTY, isTarget: true },
            { id: "tree3", emoji: "🌳", label: EMPTY, isTarget: false },
            { id: "tree4", emoji: "🌳", label: EMPTY, isTarget: false },
          ],
        },
        {
          id: "birds",
          prompt: EMPTY,
          items: [
            { id: "bird1", emoji: "🐦", label: EMPTY, isTarget: false },
            { id: "bird2", emoji: "🐦", label: EMPTY, isTarget: false },
            { id: "fish", emoji: "🐟", label: EMPTY, isTarget: true },
            { id: "bird3", emoji: "🐦", label: EMPTY, isTarget: false },
          ],
        },
        {
          id: "fruit",
          prompt: EMPTY,
          items: [
            { id: "apple1", emoji: "🍎", label: EMPTY, isTarget: false },
            { id: "apple2", emoji: "🍎", label: EMPTY, isTarget: false },
            { id: "apple3", emoji: "🍎", label: EMPTY, isTarget: false },
            { id: "banana", emoji: "🍌", label: EMPTY, isTarget: true },
          ],
        },
      ],
    },
  },

  // 15. Эко-саяхат — a short journey of quick nature questions
  {
    key: "eco-quest",
    title: { kk: "Эко-саяхат", ru: "Эко-путешествие", en: "Eco Journey" },
    description: { kk: "Кішкентай саяхатқа шық!", ru: "Отправься в путешествие!", en: "Go on a little journey!" },
    icon: "Rocket",
    color: COLORS.game,
    difficulty: "medium",
    ageMin: 5,
    ageMax: 6,
    xpReward: 30,
    badgeKey: "eco_champion",
    template: "quiz_match",
    order: 14,
    config: {
      questions: [
        {
          id: "q1",
          emoji: "🌳",
          prompt: EMPTY,
          options: [
            { id: "tree", emoji: "🌳", label: EMPTY },
            { id: "trash", emoji: "🗑️", label: EMPTY },
          ],
          correctOptionId: "tree",
        },
        {
          id: "q2",
          emoji: "💧",
          prompt: EMPTY,
          options: [
            { id: "closed", emoji: "🚱", label: EMPTY },
            { id: "open", emoji: "🚰", label: EMPTY },
          ],
          correctOptionId: "closed",
        },
        {
          id: "q3",
          emoji: "🐝",
          prompt: EMPTY,
          options: [
            { id: "flower", emoji: "🌸", label: EMPTY },
            { id: "spray", emoji: "🧴", label: EMPTY },
          ],
          correctOptionId: "flower",
        },
      ],
    },
  },
];

export const ECOGAME_ACHIEVEMENTS: AchievementSeed[] = ECOGAMES.map((g) => ({
  key: g.badgeKey,
  title: badgeTitle(g.badgeKey),
  description: badgeDescription(g.key),
  icon: badgeIcon(g.badgeKey),
  xpReward: g.xpReward,
}));

function badgeTitle(badgeKey: string): Localized {
  const titles: Record<string, Localized> = {
    seed_planter: { kk: "Тұқым егуші", ru: "Юный садовод", en: "Seed Planter" },
    flower_waterer: { kk: "Гүл күтушісі", ru: "Хранитель цветов", en: "Flower Keeper" },
    tree_grower: { kk: "Ағаш өсіруші", ru: "Хранитель деревьев", en: "Tree Grower" },
    bee_friend: { kk: "Араның досы", ru: "Друг пчёл", en: "Bee Friend" },
    river_guardian: { kk: "Өзен қорғаушысы", ru: "Хранитель реки", en: "River Guardian" },
    animal_helper: { kk: "Жануарлар досы", ru: "Друг животных", en: "Animal Helper" },
    plant_helper: { kk: "Өсімдік досы", ru: "Друг растений", en: "Plant Helper" },
    fruit_collector: { kk: "Жеміс жинаушы", ru: "Сборщик фруктов", en: "Fruit Collector" },
    color_spotter: { kk: "Түс білгірі", ru: "Знаток цветов", en: "Color Spotter" },
    recycling_master: { kk: "Қайта өңдеу шебері", ru: "Мастер переработки", en: "Recycling Master" },
    puzzle_master: { kk: "Пазл шебері", ru: "Мастер пазлов", en: "Puzzle Master" },
    sound_explorer: { kk: "Дыбыс зерттеушісі", ru: "Знаток звуков", en: "Sound Explorer" },
    sharp_eyes: { kk: "Байқампаз көз", ru: "Зоркий глаз", en: "Sharp Eyes" },
    eco_champion: { kk: "Эко чемпион", ru: "Эко-чемпион", en: "Eco Champion" },
  };
  return titles[badgeKey] ?? { kk: "Белгі", ru: "Значок", en: "Badge" };
}

function badgeDescription(gameKey: string): Localized {
  return {
    kk: "Ойында жарайсың дегенге ие болды",
    ru: "Отлично сыграл(а) в игру",
    en: `Did great playing "${gameKey}"`,
  };
}

function badgeIcon(badgeKey: string): string {
  const icons: Record<string, string> = {
    seed_planter: "sprout",
    flower_waterer: "droplets",
    tree_grower: "tree-pine",
    bee_friend: "bug",
    river_guardian: "waves",
    animal_helper: "paw-print",
    plant_helper: "flower-2",
    fruit_collector: "sparkles",
    color_spotter: "flower-2",
    recycling_master: "factory",
    puzzle_master: "puzzle",
    sound_explorer: "music-2",
    sharp_eyes: "sparkles",
    eco_champion: "rocket",
  };
  return icons[badgeKey] ?? "award";
}
