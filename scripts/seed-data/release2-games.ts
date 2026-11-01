/**
 * Release 2: ten age-banded EcoGame games. Pure content — every game
 * reuses one of the existing interaction engines
 * (src/lib/domain/game-templates), so no new client component or
 * scorer is needed.
 *
 * This file is the single source of truth for both:
 *  - scripts/seed.ts (local/demo databases), and
 *  - src/db/migrations/0016_release2_users_games.sql, whose games
 *    INSERT is generated from it by scripts/gen-release2-games-sql.ts
 *    (production gets the games without running the seed).
 * src/lib/domain/release2-games.test.ts fails if the two drift apart.
 *
 * Standalone module, like seed.ts itself — no src/@ imports.
 */

type Localized = { kk: string; ru: string; en: string };
type AgeCategory = "MIDDLE_3" | "SENIOR_4" | "PRESCHOOL_5";

export type Release2Game = {
  key: string;
  title: Localized;
  description: Localized;
  icon: string;
  color: string;
  difficulty: "easy" | "medium" | "hard";
  ageMin: number;
  ageMax: number;
  ageCategories: AgeCategory[];
  xpReward: number;
  template: "click_target" | "puzzle_assemble" | "drag_sort" | "sound_match" | "sequence_order" | "quiz_match" | "scenario_decision";
  order: number;
  config: unknown;
};

const L = (kk: string, ru: string, en: string): Localized => ({ kk, ru, en });

export const RELEASE2_GAMES: Release2Game[] = [
  // ── 3–4 жас ──────────────────────────────────────────────────────
  {
    key: "r2-find-colors",
    title: L("Түстерді тап", "Найди цвета", "Find the Colors"),
    description: L("Айтылған түсті заттарды тап!", "Найди предметы нужного цвета!", "Find things of the named color!"),
    icon: "Palette",
    color: "var(--module-media)",
    difficulty: "easy",
    ageMin: 3,
    ageMax: 4,
    ageCategories: ["MIDDLE_3"],
    xpReward: 20,
    template: "click_target",
    order: 101,
    config: {
      rounds: [
        {
          id: "red",
          prompt: L("Қызыл заттарды тап! 🔴", "Найди красное! 🔴", "Find the red things! 🔴"),
          items: [
            { id: "apple", emoji: "🍎", label: L("Алма", "Яблоко", "Apple"), isTarget: true },
            { id: "strawberry", emoji: "🍓", label: L("Құлпынай", "Клубника", "Strawberry"), isTarget: true },
            { id: "leaf", emoji: "🍃", label: L("Жапырақ", "Лист", "Leaf"), isTarget: false },
            { id: "banana", emoji: "🍌", label: L("Банан", "Банан", "Banana"), isTarget: false },
          ],
        },
        {
          id: "green",
          prompt: L("Жасыл заттарды тап! 🟢", "Найди зелёное! 🟢", "Find the green things! 🟢"),
          items: [
            { id: "frog", emoji: "🐸", label: L("Бақа", "Лягушка", "Frog"), isTarget: true },
            { id: "clover", emoji: "🍀", label: L("Беде", "Клевер", "Clover"), isTarget: true },
            { id: "sun", emoji: "☀️", label: L("Күн", "Солнце", "Sun"), isTarget: false },
            { id: "cherry", emoji: "🍒", label: L("Шие", "Вишня", "Cherry"), isTarget: false },
          ],
        },
        {
          id: "yellow",
          prompt: L("Сары заттарды тап! 🟡", "Найди жёлтое! 🟡", "Find the yellow things! 🟡"),
          items: [
            { id: "sunflower", emoji: "🌻", label: L("Күнбағыс", "Подсолнух", "Sunflower"), isTarget: true },
            { id: "chick", emoji: "🐤", label: L("Балапан", "Цыплёнок", "Chick"), isTarget: true },
            { id: "drop", emoji: "💧", label: L("Тамшы", "Капля", "Drop"), isTarget: false },
            { id: "tree", emoji: "🌲", label: L("Шырша", "Ель", "Fir"), isTarget: false },
          ],
        },
        {
          id: "blue",
          prompt: L("Көк заттарды тап! 🔵", "Найди синее! 🔵", "Find the blue things! 🔵"),
          items: [
            { id: "whale", emoji: "🐳", label: L("Кит", "Кит", "Whale"), isTarget: true },
            { id: "butterfly", emoji: "🦋", label: L("Көбелек", "Бабочка", "Butterfly"), isTarget: true },
            { id: "carrot", emoji: "🥕", label: L("Сәбіз", "Морковь", "Carrot"), isTarget: false },
            { id: "rose", emoji: "🌹", label: L("Раушан", "Роза", "Rose"), isTarget: false },
          ],
        },
      ],
    },
  },
  {
    key: "r2-animal-home",
    title: L("Жануардың үйі", "Домик для зверька", "Animal's Home"),
    description: L("Әр жануарды өз үйіне апар!", "Отведи каждого зверька домой!", "Take each animal to its home!"),
    icon: "PawPrint",
    color: "var(--module-greenhouse)",
    difficulty: "easy",
    ageMin: 3,
    ageMax: 4,
    ageCategories: ["MIDDLE_3"],
    xpReward: 20,
    template: "puzzle_assemble",
    order: 102,
    config: {
      slots: [
        { id: "nest", emoji: "🪺" },
        { id: "sea", emoji: "🌊" },
        { id: "house", emoji: "🏠" },
        { id: "hole", emoji: "🕳️" },
      ],
      pieces: [
        { id: "bird", emoji: "🐦", slotId: "nest" },
        { id: "fish", emoji: "🐟", slotId: "sea" },
        { id: "dog", emoji: "🐶", slotId: "house" },
        { id: "mouse", emoji: "🐭", slotId: "hole" },
      ],
    },
  },
  {
    key: "r2-fruit-or-veg",
    title: L("Жеміс пе, көкөніс пе?", "Фрукт или овощ?", "Fruit or Vegetable?"),
    description: L("Жемісті — себетке, көкөністі — қорапқа сал!", "Фрукты — в корзину, овощи — в ящик!", "Fruit in the basket, veggies in the box!"),
    icon: "Sprout",
    color: "var(--module-ecolab)",
    difficulty: "easy",
    ageMin: 3,
    ageMax: 4,
    ageCategories: ["MIDDLE_3"],
    xpReward: 20,
    template: "drag_sort",
    order: 103,
    config: {
      roundSize: 6,
      categories: [
        { id: "fruit", label: L("Жеміс", "Фрукт", "Fruit"), color: "#ef4444", emoji: "🧺" },
        { id: "veg", label: L("Көкөніс", "Овощ", "Vegetable"), color: "#16a34a", emoji: "📦" },
      ],
      items: [
        { id: "apple", emoji: "🍎", label: L("Алма", "Яблоко", "Apple"), correctCategoryId: "fruit" },
        { id: "pear", emoji: "🍐", label: L("Алмұрт", "Груша", "Pear"), correctCategoryId: "fruit" },
        { id: "grapes", emoji: "🍇", label: L("Жүзім", "Виноград", "Grapes"), correctCategoryId: "fruit" },
        { id: "orange", emoji: "🍊", label: L("Апельсин", "Апельсин", "Orange"), correctCategoryId: "fruit" },
        { id: "carrot", emoji: "🥕", label: L("Сәбіз", "Морковь", "Carrot"), correctCategoryId: "veg" },
        { id: "cucumber", emoji: "🥒", label: L("Қияр", "Огурец", "Cucumber"), correctCategoryId: "veg" },
        { id: "potato", emoji: "🥔", label: L("Картоп", "Картофель", "Potato"), correctCategoryId: "veg" },
        { id: "tomato", emoji: "🍅", label: L("Қызанақ", "Помидор", "Tomato"), correctCategoryId: "veg" },
      ],
    },
  },
  {
    key: "r2-nature-sounds",
    title: L("Табиғат дыбыстары", "Звуки природы", "Nature Sounds"),
    description: L("Тыңда да, дыбыстың суретін тап!", "Послушай и найди картинку!", "Listen and tap the picture!"),
    icon: "Music2",
    color: "var(--module-research)",
    difficulty: "easy",
    ageMin: 3,
    ageMax: 4,
    ageCategories: ["MIDDLE_3"],
    xpReward: 20,
    template: "sound_match",
    order: 104,
    config: {
      rounds: [
        {
          id: "bird",
          sound: "bird",
          options: [
            { id: "bird", emoji: "🐦", label: L("Құс", "Птица", "Bird") },
            { id: "fish", emoji: "🐟", label: L("Балық", "Рыба", "Fish") },
          ],
          correctOptionId: "bird",
        },
        {
          id: "rain",
          sound: "rain",
          options: [
            { id: "sun", emoji: "☀️", label: L("Күн", "Солнце", "Sun") },
            { id: "rain", emoji: "🌧️", label: L("Жаңбыр", "Дождь", "Rain") },
          ],
          correctOptionId: "rain",
        },
        {
          id: "bee",
          sound: "bee",
          options: [
            { id: "bee", emoji: "🐝", label: L("Ара", "Пчела", "Bee") },
            { id: "snail", emoji: "🐌", label: L("Ұлу", "Улитка", "Snail") },
          ],
          correctOptionId: "bee",
        },
        {
          id: "wind",
          sound: "wind",
          options: [
            { id: "flower", emoji: "🌷", label: L("Гүл", "Цветок", "Flower") },
            { id: "wind", emoji: "🌬️", label: L("Жел", "Ветер", "Wind") },
          ],
          correctOptionId: "wind",
        },
      ],
    },
  },

  // ── 4–5 жас ──────────────────────────────────────────────────────
  {
    key: "r2-waste-sort",
    title: L("Қоқысты дұрыс бөл", "Раздели мусор правильно", "Sort the Waste"),
    description: L("Әр қоқысты өз контейнеріне сал!", "Положи мусор в нужный контейнер!", "Put each piece in the right bin!"),
    icon: "Factory",
    color: "var(--module-game)",
    difficulty: "medium",
    ageMin: 4,
    ageMax: 5,
    ageCategories: ["SENIOR_4"],
    xpReward: 30,
    template: "drag_sort",
    order: 105,
    config: {
      roundSize: 8,
      categories: [
        { id: "paper", label: L("Қағаз", "Бумага", "Paper"), color: "#2563eb", emoji: "📰" },
        { id: "plastic", label: L("Пластик", "Пластик", "Plastic"), color: "#eab308", emoji: "🧴" },
        { id: "glass", label: L("Шыны", "Стекло", "Glass"), color: "#16a34a", emoji: "🫙" },
        { id: "organic", label: L("Тағам қалдығы", "Пищевые отходы", "Food waste"), color: "#a16207", emoji: "🍂" },
      ],
      items: [
        { id: "newspaper", emoji: "🗞️", label: L("Газет", "Газета", "Newspaper"), correctCategoryId: "paper" },
        { id: "box", emoji: "📦", label: L("Картон қорап", "Картонная коробка", "Cardboard box"), correctCategoryId: "paper" },
        { id: "bottle", emoji: "🧴", label: L("Пластик бөтелке", "Пластиковая бутылка", "Plastic bottle"), correctCategoryId: "plastic" },
        { id: "bag", emoji: "🛍️", label: L("Пакет", "Пакет", "Bag"), correctCategoryId: "plastic" },
        { id: "jar", emoji: "🫙", label: L("Шыны банка", "Стеклянная банка", "Glass jar"), correctCategoryId: "glass" },
        { id: "glass-bottle", emoji: "🍾", label: L("Шыны бөтелке", "Стеклянная бутылка", "Glass bottle"), correctCategoryId: "glass" },
        { id: "peel", emoji: "🍌", label: L("Банан қабығы", "Банановая кожура", "Banana peel"), correctCategoryId: "organic" },
        { id: "core", emoji: "🍏", label: L("Алма қалдығы", "Огрызок яблока", "Apple core"), correctCategoryId: "organic" },
      ],
    },
  },
  {
    key: "r2-plant-growth",
    title: L("Өсімдіктің өсу реті", "Как растёт растение", "How a Plant Grows"),
    description: L("Суреттерді өсу ретімен қой!", "Расставь картинки по порядку роста!", "Put the pictures in growing order!"),
    icon: "Flower2",
    color: "var(--module-greenhouse)",
    difficulty: "medium",
    ageMin: 4,
    ageMax: 5,
    ageCategories: ["SENIOR_4"],
    xpReward: 30,
    template: "sequence_order",
    order: 106,
    config: {
      sequences: [
        {
          id: "flower",
          prompt: L("Гүл қалай өседі?", "Как растёт цветок?", "How does a flower grow?"),
          steps: [
            { id: "seed", emoji: "🌰", label: L("Тұқым", "Семечко", "Seed") },
            { id: "sprout", emoji: "🌱", label: L("Өскін", "Росток", "Sprout") },
            { id: "bud", emoji: "🌿", label: L("Бүршік", "Бутон", "Bud") },
            { id: "bloom", emoji: "🌷", label: L("Гүл", "Цветок", "Flower") },
          ],
        },
        {
          id: "tree",
          prompt: L("Ағаш қалай өседі?", "Как растёт дерево?", "How does a tree grow?"),
          steps: [
            { id: "acorn", emoji: "🌰", label: L("Тұқым", "Жёлудь", "Acorn") },
            { id: "sapling", emoji: "🌱", label: L("Көшет", "Саженец", "Sapling") },
            { id: "young", emoji: "🪴", label: L("Жас ағаш", "Молодое дерево", "Young tree") },
            { id: "big", emoji: "🌳", label: L("Үлкен ағаш", "Большое дерево", "Big tree") },
          ],
        },
        {
          id: "apple",
          prompt: L("Алма қалай пайда болады?", "Как появляется яблоко?", "Where does an apple come from?"),
          steps: [
            { id: "blossom", emoji: "🌸", label: L("Гүл", "Цветок", "Blossom") },
            { id: "green", emoji: "🍏", label: L("Жасыл алма", "Зелёное яблоко", "Green apple") },
            { id: "ripe", emoji: "🍎", label: L("Піскен алма", "Спелое яблоко", "Ripe apple") },
          ],
        },
      ],
    },
  },
  {
    key: "r2-who-eats-what",
    title: L("Кім не жейді?", "Кто что ест?", "Who Eats What?"),
    description: L("Жануарға дұрыс тамақ тап!", "Найди еду для зверька!", "Find the right food for each animal!"),
    icon: "Bug",
    color: "var(--module-ecolab)",
    difficulty: "medium",
    ageMin: 4,
    ageMax: 5,
    ageCategories: ["SENIOR_4"],
    xpReward: 30,
    template: "quiz_match",
    order: 107,
    config: {
      questions: [
        {
          id: "rabbit",
          emoji: "🐰",
          prompt: L("Қоян не жейді?", "Что ест зайчик?", "What does a rabbit eat?"),
          options: [
            { id: "carrot", emoji: "🥕", label: L("Сәбіз", "Морковь", "Carrot") },
            { id: "bone", emoji: "🦴", label: L("Сүйек", "Кость", "Bone") },
            { id: "fish", emoji: "🐟", label: L("Балық", "Рыба", "Fish") },
          ],
          correctOptionId: "carrot",
        },
        {
          id: "cat",
          emoji: "🐱",
          prompt: L("Мысық не жейді?", "Что ест кошка?", "What does a cat eat?"),
          options: [
            { id: "grass", emoji: "🌾", label: L("Шөп", "Трава", "Grass") },
            { id: "fish", emoji: "🐟", label: L("Балық", "Рыба", "Fish") },
            { id: "nut", emoji: "🌰", label: L("Жаңғақ", "Орех", "Nut") },
          ],
          correctOptionId: "fish",
        },
        {
          id: "squirrel",
          emoji: "🐿️",
          prompt: L("Тиін не жейді?", "Что ест белка?", "What does a squirrel eat?"),
          options: [
            { id: "nut", emoji: "🌰", label: L("Жаңғақ", "Орех", "Nut") },
            { id: "milk", emoji: "🥛", label: L("Сүт", "Молоко", "Milk") },
            { id: "bone", emoji: "🦴", label: L("Сүйек", "Кость", "Bone") },
          ],
          correctOptionId: "nut",
        },
        {
          id: "cow",
          emoji: "🐄",
          prompt: L("Сиыр не жейді?", "Что ест корова?", "What does a cow eat?"),
          options: [
            { id: "fish", emoji: "🐟", label: L("Балық", "Рыба", "Fish") },
            { id: "grass", emoji: "🌾", label: L("Шөп", "Трава", "Grass") },
            { id: "cheese", emoji: "🧀", label: L("Ірімшік", "Сыр", "Cheese") },
          ],
          correctOptionId: "grass",
        },
        {
          id: "bee",
          emoji: "🐝",
          prompt: L("Ара неден шырын алады?", "Откуда пчела берёт нектар?", "Where does a bee get nectar?"),
          options: [
            { id: "flower", emoji: "🌼", label: L("Гүл", "Цветок", "Flower") },
            { id: "stone", emoji: "🪨", label: L("Тас", "Камень", "Stone") },
            { id: "bread", emoji: "🍞", label: L("Нан", "Хлеб", "Bread") },
          ],
          correctOptionId: "flower",
        },
      ],
    },
  },

  // ── 5–6 жас ──────────────────────────────────────────────────────
  {
    key: "r2-water-cycle",
    title: L("Су айналымы", "Круговорот воды", "The Water Cycle"),
    description: L("Су қалай айналып жүреді? Ретімен қой!", "Как путешествует вода? Расставь по порядку!", "How does water travel? Put it in order!"),
    icon: "CloudSun",
    color: "var(--module-research)",
    difficulty: "hard",
    ageMin: 5,
    ageMax: 6,
    ageCategories: ["PRESCHOOL_5"],
    xpReward: 40,
    template: "sequence_order",
    order: 108,
    config: {
      sequences: [
        {
          id: "cycle",
          prompt: L("Су айналымын ретімен қой", "Расставь круговорот воды", "Order the water cycle"),
          steps: [
            { id: "sea", emoji: "🌊", label: L("Теңіздегі су", "Вода в море", "Water in the sea") },
            { id: "evaporate", emoji: "☀️", label: L("Күн суды буландырады", "Солнце испаряет воду", "The sun warms the water") },
            { id: "cloud", emoji: "☁️", label: L("Бұлт пайда болады", "Появляется облако", "A cloud forms") },
            { id: "rain", emoji: "🌧️", label: L("Жаңбыр жауады", "Идёт дождь", "It rains") },
          ],
        },
        {
          id: "puddle",
          prompt: L("Шалшық қайда кетті?", "Куда делась лужа?", "Where did the puddle go?"),
          steps: [
            { id: "rain", emoji: "🌧️", label: L("Жаңбыр", "Дождь", "Rain") },
            { id: "puddle", emoji: "💧", label: L("Шалшық", "Лужа", "Puddle") },
            { id: "sun", emoji: "🌞", label: L("Күн шықты", "Вышло солнце", "Sunshine") },
            { id: "dry", emoji: "🏜️", label: L("Шалшық кепті", "Лужа высохла", "The puddle dried") },
          ],
        },
        {
          id: "snow",
          prompt: L("Қар қалай суға айналады?", "Как снег становится водой?", "How does snow turn into water?"),
          steps: [
            { id: "snow", emoji: "❄️", label: L("Қар", "Снег", "Snow") },
            { id: "spring", emoji: "🌤️", label: L("Көктем, жылы", "Весна, тепло", "Warm spring") },
            { id: "stream", emoji: "🏞️", label: L("Өзен", "Ручей", "Stream") },
          ],
        },
      ],
    },
  },
  {
    key: "r2-eco-decision",
    title: L("Экологиялық шешім", "Экологичный выбор", "Eco Choice"),
    description: L("Табиғатқа көмектесетін дұрыс шешімді таңда!", "Выбери, как помочь природе!", "Choose how to help nature!"),
    icon: "ShieldCheck",
    color: "var(--module-passport)",
    difficulty: "hard",
    ageMin: 5,
    ageMax: 6,
    ageCategories: ["PRESCHOOL_5"],
    xpReward: 40,
    template: "scenario_decision",
    order: 109,
    config: {
      scenarios: [
        {
          id: "tap",
          emoji: "🚰",
          prompt: L("Тісіңді жуып болдың. Кран ашық қалды. Не істейсің?", "Ты почистил зубы, а кран открыт. Что сделаешь?", "You brushed your teeth and the tap is still on. What do you do?"),
          choices: [
            { id: "close", emoji: "✋", label: L("Кранды жабамын", "Закрою кран", "Turn the tap off"), isBest: true },
            { id: "leave", emoji: "💦", label: L("Ашық қалдырамын", "Оставлю открытым", "Leave it running"), isBest: false },
          ],
        },
        {
          id: "litter",
          emoji: "🌳",
          prompt: L("Саябақта жерде пакет жатыр. Не істейсің?", "В парке на земле лежит пакет. Что сделаешь?", "There's a bag on the ground in the park. What do you do?"),
          choices: [
            { id: "bin", emoji: "🗑️", label: L("Қоқыс жәшігіне саламын", "Выброшу в урну", "Put it in the bin"), isBest: true },
            { id: "kick", emoji: "🦶", label: L("Тебемін де кетемін", "Пну и уйду", "Kick it away"), isBest: false },
            { id: "ignore", emoji: "🙈", label: L("Көрмегендей боламын", "Сделаю вид, что не видел", "Pretend not to see"), isBest: false },
          ],
        },
        {
          id: "light",
          emoji: "💡",
          prompt: L("Бөлмеден шығып барасың, шам жанып тұр. Не істейсің?", "Ты выходишь из комнаты, а свет горит. Что сделаешь?", "You leave the room and the light is on. What do you do?"),
          choices: [
            { id: "off", emoji: "🔌", label: L("Шамды сөндіремін", "Выключу свет", "Switch it off"), isBest: true },
            { id: "on", emoji: "🔆", label: L("Жана берсін", "Пусть горит", "Leave it on"), isBest: false },
          ],
        },
        {
          id: "flower",
          emoji: "🌼",
          prompt: L("Әдемі гүл өсіп тұр. Не істейсің?", "Растёт красивый цветок. Что сделаешь?", "A pretty flower is growing. What do you do?"),
          choices: [
            { id: "admire", emoji: "👀", label: L("Қарап, суретке түсіремін", "Полюбуюсь и сфотографирую", "Look and take a photo"), isBest: true },
            { id: "pick", emoji: "✂️", label: L("Жұлып аламын", "Сорву", "Pick it"), isBest: false },
          ],
        },
        {
          id: "bag",
          emoji: "🛒",
          prompt: L("Анаңмен дүкенге барасың. Не аласың?", "Идёшь с мамой в магазин. Что возьмёшь?", "You go shopping with mum. What do you take?"),
          choices: [
            { id: "cloth", emoji: "👜", label: L("Мата сөмке", "Тканевую сумку", "A cloth bag"), isBest: true },
            { id: "plastic", emoji: "🛍️", label: L("Жаңа пластик пакет", "Новый пластиковый пакет", "A new plastic bag"), isBest: false },
          ],
        },
      ],
    },
  },
  {
    key: "r2-nature-explorer",
    title: L("Табиғат зерттеушісі", "Юный исследователь", "Nature Explorer"),
    description: L("Лупамен қара да, тапсырмадағыларды тап!", "Посмотри в лупу и найди нужное!", "Look closely and find what's asked!"),
    icon: "Compass",
    color: "var(--module-analytics)",
    difficulty: "hard",
    ageMin: 5,
    ageMax: 6,
    ageCategories: ["PRESCHOOL_5"],
    xpReward: 40,
    template: "click_target",
    order: 110,
    config: {
      rounds: [
        {
          id: "insects",
          prompt: L("🔍 Барлық жәндіктерді тап!", "🔍 Найди всех насекомых!", "🔍 Find all the insects!"),
          items: [
            { id: "ladybug", emoji: "🐞", label: L("Қанқызы", "Божья коровка", "Ladybug"), isTarget: true },
            { id: "bee", emoji: "🐝", label: L("Ара", "Пчела", "Bee"), isTarget: true },
            { id: "ant", emoji: "🐜", label: L("Құмырсқа", "Муравей", "Ant"), isTarget: true },
            { id: "fish", emoji: "🐟", label: L("Балық", "Рыба", "Fish"), isTarget: false },
            { id: "cat", emoji: "🐱", label: L("Мысық", "Кошка", "Cat"), isTarget: false },
            { id: "rose", emoji: "🌹", label: L("Раушан", "Роза", "Rose"), isTarget: false },
          ],
        },
        {
          id: "autumn",
          prompt: L("🍂 Күзде болатындарды тап!", "🍂 Найди то, что бывает осенью!", "🍂 Find what happens in autumn!"),
          items: [
            { id: "leaf", emoji: "🍂", label: L("Сары жапырақ", "Жёлтые листья", "Yellow leaves"), isTarget: true },
            { id: "mushroom", emoji: "🍄", label: L("Саңырауқұлақ", "Гриб", "Mushroom"), isTarget: true },
            { id: "pumpkin", emoji: "🎃", label: L("Асқабақ", "Тыква", "Pumpkin"), isTarget: true },
            { id: "snowman", emoji: "⛄", label: L("Аққала", "Снеговик", "Snowman"), isTarget: false },
            { id: "beach", emoji: "🏖️", label: L("Жағажай", "Пляж", "Beach"), isTarget: false },
            { id: "tulip", emoji: "🌷", label: L("Қызғалдақ", "Тюльпан", "Tulip"), isTarget: false },
          ],
        },
        {
          id: "water-animals",
          prompt: L("🌊 Суда тұратындарды тап!", "🌊 Найди тех, кто живёт в воде!", "🌊 Find who lives in water!"),
          items: [
            { id: "fish", emoji: "🐠", label: L("Балық", "Рыба", "Fish"), isTarget: true },
            { id: "octopus", emoji: "🐙", label: L("Сегізаяқ", "Осьминог", "Octopus"), isTarget: true },
            { id: "dolphin", emoji: "🐬", label: L("Дельфин", "Дельфин", "Dolphin"), isTarget: true },
            { id: "horse", emoji: "🐴", label: L("Жылқы", "Лошадь", "Horse"), isTarget: false },
            { id: "owl", emoji: "🦉", label: L("Үкі", "Сова", "Owl"), isTarget: false },
            { id: "camel", emoji: "🐫", label: L("Түйе", "Верблюд", "Camel"), isTarget: false },
          ],
        },
        {
          id: "seeds",
          prompt: L("🌱 Ішінде тұқымы барларды тап!", "🌱 Найди то, в чём есть семена!", "🌱 Find things with seeds inside!"),
          items: [
            { id: "watermelon", emoji: "🍉", label: L("Қарбыз", "Арбуз", "Watermelon"), isTarget: true },
            { id: "apple", emoji: "🍎", label: L("Алма", "Яблоко", "Apple"), isTarget: true },
            { id: "sunflower", emoji: "🌻", label: L("Күнбағыс", "Подсолнух", "Sunflower"), isTarget: true },
            { id: "rock", emoji: "🪨", label: L("Тас", "Камень", "Rock"), isTarget: false },
            { id: "cloud", emoji: "☁️", label: L("Бұлт", "Облако", "Cloud"), isTarget: false },
            { id: "drop", emoji: "💧", label: L("Тамшы", "Капля", "Drop"), isTarget: false },
          ],
        },
      ],
    },
  },
];

