import { pickDeterministic, stableFloat, stableHash } from "@/lib/ai/hash";
import type {
  AiProvider,
  ChatInput,
  ChatOutput,
  LessonBundle,
  RecognitionInput,
  RecognitionOutput,
  StoryboardOutput,
  StructuredInput,
  StoryOutput,
} from "@/lib/ai/types";

const CHAT_REPLIES: Record<string, string[]> = {
  kk: [
    "Табиғат туралы жақсы сұрақ! 🌱 Өсімдіктер күн сәулесінен тамақ жасайды.",
    "Керемет! 🐝 Аралар гүлдерден нектар жинап, бал жасайды.",
    "Білесің бе? 💧 Су — барлық тірі жәндіктерге өте қажет.",
    "Қызық сұрақ! 🍂 Күзде жапырақтар түсі өзгереді, өйткені ауа райы суытады.",
  ],
  ru: [
    "Отличный вопрос о природе! 🌱 Растения делают еду из солнечного света.",
    "Здорово! 🐝 Пчёлы собирают нектар с цветов и делают мёд.",
    "А ты знал? 💧 Вода очень нужна всем живым существам.",
    "Интересный вопрос! 🍂 Осенью листья меняют цвет, потому что становится холоднее.",
  ],
  en: [
    "Great nature question! 🌱 Plants make food from sunlight.",
    "Awesome! 🐝 Bees collect nectar from flowers to make honey.",
    "Did you know? 💧 Water is very important for all living things.",
    "Fun question! 🍂 In autumn, leaves change color because it gets colder.",
  ],
};

const TEACHER_REPLIES: Record<string, string> = {
  kk: "Бұл тақырып бойынша сабақ жоспарын EcoAI Studio арқылы бір батырмамен жасай аласыз. Балаларға арналған қарапайым тәжірибелерді ұсынамын: тұқым өсіру, жапырақ коллекциясы, су айналымын бақылау.",
  ru: "Для этой темы можно сгенерировать план урока одной кнопкой в EcoAI Studio. Рекомендую простые опыты: проращивание семян, коллекция листьев, наблюдение за круговоротом воды.",
  en: "You can generate a full lesson plan for this topic with one click in the AI Studio. Simple experiments to try: sprouting seeds, a leaf collection, or observing the water cycle.",
};

const DEMO_SPECIES = [
  { kk: "Ромашка (дала гүлі)", ru: "Ромашка", en: "Daisy", kind: "PLANT" as const, toxic: false },
  { kk: "Емен жапырағы", ru: "Дубовый лист", en: "Oak leaf", kind: "LEAF" as const, toxic: false },
  { kk: "Күнбағыс", ru: "Подсолнух", en: "Sunflower", kind: "PLANT" as const, toxic: false },
  { kk: "Көбелек", ru: "Бабочка", en: "Butterfly", kind: "ANIMAL" as const, toxic: false },
  { kk: "Қызыл мұқыт саңырауқұлақ", ru: "Мухомор", en: "Fly agaric mushroom", kind: "PLANT" as const, toxic: true },
  { kk: "Су құты", ru: "Лейка", en: "Watering can", kind: "OBJECT" as const, toxic: false },
];

const FUN_FACTS: Record<string, string> = {
  kk: "Табиғатта әр тірі жәндіктің өз орны бар және олар бір-біріне көмектеседі.",
  ru: "В природе у каждого живого существа есть своё место, и они помогают друг другу.",
  en: "In nature, every living thing has its place, and they all help each other.",
};

export class MockAiProvider implements AiProvider {
  readonly id = "mock" as const;
  readonly isMock = true;

  async chat(input: ChatInput): Promise<ChatOutput> {
    if (input.audience === "teacher") {
      return { reply: TEACHER_REPLIES[input.locale] };
    }
    const options = CHAT_REPLIES[input.locale] ?? CHAT_REPLIES.en;
    return { reply: pickDeterministic(options, input.message || "default") };
  }

  async recognizeImage(input: RecognitionInput): Promise<RecognitionOutput> {
    const seed = `${input.imageBase64.length}:${input.mimeType}:${input.kindHint ?? ""}`;
    const species = pickDeterministic(DEMO_SPECIES, seed);
    const confidence = Number(stableFloat(seed, 0.42, 0.95).toFixed(2));
    return {
      label: species[input.locale],
      kind: species.kind,
      confidence,
      funFact: FUN_FACTS[input.locale] ?? FUN_FACTS.en,
      isPotentiallyToxic: species.toxic,
    };
  }

  async generateLesson(input: StructuredInput): Promise<LessonBundle> {
    const ageBand = input.ageBand ?? "5-6";
    const titles: Record<string, string> = {
      kk: `«${input.topic}» тақырыбындағы сабақ`,
      ru: `Урок на тему «${input.topic}»`,
      en: `Lesson: ${input.topic}`,
    };
    const plans: Record<string, string[]> = {
      kk: [
        "Балалармен тақырып туралы әңгіме бастау (5 мин).",
        `«${input.topic}» туралы қызықты фактілерді көрсету.`,
        "Топтық сурет салу немесе жинау белсенділігі.",
        "Бақылау журналына жазба жасау.",
        "Қорытынды шеңбер: не білдік?",
      ],
      ru: [
        "Начать беседу с детьми на тему (5 мин).",
        `Показать интересные факты про «${input.topic}».`,
        "Групповая activity: рисование или сбор материалов.",
        "Запись в журнал наблюдений.",
        "Итоговый круг: что мы узнали?",
      ],
      en: [
        "Start a group conversation on the topic (5 min).",
        `Share fun facts about "${input.topic}".`,
        "Group activity: drawing or a collection task.",
        "Write an entry in the observation journal.",
        "Closing circle: what did we learn?",
      ],
    };
    return {
      title: titles[input.locale],
      ageBand,
      objective:
        input.locale === "kk"
          ? `Балалар «${input.topic}» туралы негізгі түсінік алады.`
          : input.locale === "ru"
            ? `Дети получат базовое понимание темы «${input.topic}».`
            : `Children build a basic understanding of ${input.topic}.`,
      plan: plans[input.locale],
      quiz: [
        {
          question:
            input.locale === "kk"
              ? `«${input.topic}» неге маңызды?`
              : input.locale === "ru"
                ? `Почему важна тема «${input.topic}»?`
                : `Why is ${input.topic} important?`,
          options:
            input.locale === "kk"
              ? ["Табиғатқа пайдалы", "Ешқандай мәні жоқ", "Білмеймін"]
              : input.locale === "ru"
                ? ["Полезно для природы", "Не имеет значения", "Не знаю"]
                : ["It helps nature", "It doesn't matter", "I don't know"],
          correctIndex: 0,
        },
      ],
      homeworkTip:
        input.locale === "kk"
          ? "Үйде ата-анамен бірге осы тақырыпқа қатысты бір зат тауып, суретке түсіріңіз."
          : input.locale === "ru"
            ? "Дома вместе с родителями найдите и сфотографируйте что-то по этой теме."
            : "At home with a parent, find and photograph something related to this topic.",
    };
  }

  async generateStory(input: StructuredInput): Promise<StoryOutput> {
    const titles: Record<string, string> = {
      kk: `«${input.topic}» туралы ертегі`,
      ru: `Сказка про «${input.topic}»`,
      en: `A story about ${input.topic}`,
    };
    const paragraphs: Record<string, string[]> = {
      kk: [
        `Бір күні кішкентай орманда «${input.topic}» пайда болды.`,
        "Барлық жануарлар оны көру үшін жиналды.",
        "Олар бірге ойнап, көп нәрсе үйренді.",
        "Күн батқанда, барлығы жаңа досына рахмет айтты.",
      ],
      ru: [
        `Однажды в маленьком лесу появилось «${input.topic}».`,
        "Все звери собрались, чтобы посмотреть.",
        "Они играли вместе и многому научились.",
        "Когда солнце село, все поблагодарили нового друга.",
      ],
      en: [
        `One day, in a small forest, ${input.topic} appeared.`,
        "All the animals gathered to see it.",
        "They played together and learned so much.",
        "When the sun set, everyone thanked their new friend.",
      ],
    };
    return { title: titles[input.locale], paragraphs: paragraphs[input.locale] };
  }

  async generateStoryboard(input: StructuredInput): Promise<StoryboardOutput> {
    const story = input.storyText ?? input.topic;
    const sentences = story.split(/(?<=[.!?])\s+/).filter(Boolean);
    const base = sentences.length > 0 ? sentences : [story];
    return {
      title:
        input.locale === "kk"
          ? "Оқиға тақтасы"
          : input.locale === "ru"
            ? "Раскадровка"
            : "Storyboard",
      scenes: base.slice(0, 6).map((line, i) => ({
        scene: i + 1,
        description:
          input.locale === "kk"
            ? `Көрініс ${i + 1}: суретте кейіпкерлер көрінеді.`
            : input.locale === "ru"
              ? `Сцена ${i + 1}: на экране персонажи.`
              : `Scene ${i + 1}: characters on screen.`,
        narration: line,
      })),
    };
  }
}

/** Exported for unit tests asserting determinism without spinning up the full gateway. */
export function __mockSeedFor(imageBase64: string, mimeType: string) {
  return stableHash(`${imageBase64.length}:${mimeType}:`);
}
