// Public, static description of each homepage module — what it is,
// who uses it and why. Shown on /modules/[key] (open to everyone, no
// login). Keys match homepage_modules.key (0006_cms.sql check
// constraint) and public_platform_stats().modules (0014).
//
// Nothing here is user data; usage numbers come only from the
// aggregate public_platform_stats() function.

export const MODULE_KEYS = [
  "ecolab",
  "greenhouse",
  "game",
  "media",
  "research",
  "passport",
  "family",
  "analytics",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleInfo = {
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  purpose: string;
  /** Roles that work in this module (labels, not permissions). */
  usedBy: string[];
  /** Where "Кіру" sends a signed-in user of the main role. */
  appRoute: string;
  /** Labels for this module's three usage numbers. */
  usage: { actions: string; users: string };
};

export const MODULE_INFO: Record<ModuleKey, ModuleInfo> = {
  ecolab: {
    emoji: "📷",
    name: "Эко Зертхана",
    tagline: "Сурет арқылы өсімдік пен жануарларды танып-білу",
    description:
      "Бала өсімдіктің, жапырақтың немесе жануардың суретін түсіреді, ал AI-көмекші оның не екенін қарапайым тілмен айтып, бір қызық дерек ұсынады. Әр зерттеу баланың жеке күнделігіне сақталады.",
    features: [
      "Камерамен тікелей түсіру немесе галереядан таңдау",
      "AI тану нәтижесі, сенімділік деңгейі және қызық дерек",
      "Улы болуы мүмкін өсімдіктер туралы қауіпсіздік ескертуі",
      "Зерттелген объектілердің жеке күнделігі мен тарихы",
    ],
    purpose: "Бақылау қабілетін дамыту және табиғатқа деген қызығушылықты ояту.",
    usedBy: ["Бала"],
    appRoute: "/app/child/ecolab",
    usage: { actions: "зерттелген объект", users: "зерттеуші бала" },
  },
  greenhouse: {
    emoji: "🌱",
    name: "Жасыл бөбекжай",
    tagline: "Өсімдікті бақылау, суару және өсу тарихын жүргізу",
    description:
      "Бала гүл, ағаш немесе көкөніс (қызанақ, қияр, сәбіз және т.б.) таңдап, оны күнделікті күтеді: суарады, жапырақтарын санайды, өсу кезеңін белгілейді. Барлығы суреттер арқылы — мәтін оқу міндетті емес.",
    features: [
      "Гүлдер, ағаштар, көкөністер және басқа санаттар",
      "Әр өсімдіктің өсу кезеңдері мен күтім әрекеттері",
      "Жапырақ санын суреттен таңдау (1–5)",
      "Өсу графигі мен бақылау тарихы",
    ],
    purpose: "Жауапкершілікке, тұрақты бақылауға және тірі табиғатты күтуге баулу.",
    usedBy: ["Бала"],
    appRoute: "/app/child/greenhouse",
    usage: { actions: "отырғызылған өсімдік", users: "бала бағбан" },
  },
  game: {
    emoji: "🎮",
    name: "Эко Ойын",
    tagline: "Экологияны сурет, дыбыс және ойын арқылы үйрену",
    description:
      "Қоқысты сұрыптау, жануарлардың дауысын тану, өсімдік өсіру сияқты 15 шағын ойын. Ұпай серверде есептеледі, балалар XP және белгілер жинайды.",
    features: [
      "Сүйреп апару, басу, ретімен қою сияқты 10 ойын түрі",
      "Жас санатына сай ойындар",
      "Жұлдыз, XP және жетістік белгілері",
    ],
    purpose: "Экологиялық білімді ойын арқылы бекіту.",
    usedBy: ["Бала"],
    appRoute: "/app/child/games",
    usage: { actions: "аяқталған ойын", users: "ойнаған бала" },
  },
  media: {
    emoji: "🎨",
    name: "Эко Медиа шеберханасы",
    tagline: "Ертегі, сурет және оқиға жасау",
    description:
      "Бала тақырыпты суреттен таңдайды да, AI табиғат туралы қысқа ертегі құрастырады. Ертегіні storyboard-қа айналдыруға, өз суреттерін жүктеуге болады.",
    features: ["Тақырыпты суреттен таңдау", "AI ертегі және storyboard", "Өз суреттерін сақтау"],
    purpose: "Шығармашылықты, сөйлеу тілін және қиялды дамыту.",
    usedBy: ["Бала"],
    appRoute: "/app/child/studio",
    usage: { actions: "жасалған туынды", users: "автор" },
  },
  research: {
    emoji: "🔬",
    name: "Эко Зерттеу",
    tagline: "Қарапайым тәжірибелер мен табиғатты бақылау",
    description:
      "Тәрбиеші топқа шағын зерттеу жобасын ашады: сұрақ, болжам және балаларға арналған қадамдар. Балалар бақылау нәтижесін енгізеді, тәрбиеші графикті қарап, пікір қалдырады.",
    features: [
      "Зерттеуді жоба ретінде сақтау, түзету және жариялау",
      "Балаларға арналған қадамдық тапсырмалар",
      "Үлкен батырмалармен бақылау енгізу",
      "Топтық нәтижелер графигі және тәрбиеші пікірі",
    ],
    purpose: "Зерттеушілік ойлауды, болжам жасау мен салыстыруды үйрету.",
    usedBy: ["Бала", "Тәрбиеші"],
    appRoute: "/app/research",
    usage: { actions: "бақылау жазбасы", users: "қатысқан бала" },
  },
  passport: {
    emoji: "🏅",
    name: "Эко Төлқұжат",
    tagline: "Жетістіктер, белгілер және марапаттар",
    description:
      "Баланың барлық жетістігі бір жерде: деңгей, XP, жиналған белгілер және PDF сертификаттар. Ата-ана да баласының төлқұжатын көре алады.",
    features: ["Деңгей мен XP", "Жетістік белгілері", "PDF сертификаттар"],
    purpose: "Баланың жетістігін көрнекі етіп, мотивация беру.",
    usedBy: ["Бала", "Ата-ана"],
    appRoute: "/app/passport",
    usage: { actions: "алынған белгі", users: "белгі алған бала" },
  },
  family: {
    emoji: "👨‍👩‍👧",
    name: "Эко Отбасы",
    tagline: "Ата-анаға арналған баланың даму көрсеткіштері",
    description:
      "Ата-ана баласының апталық белсенділігін, жаңа белгілерін және тәрбиеші берген үй тапсырмаларын көреді. Ата-ана тек өз баласының деректерін ғана көреді.",
    features: ["Апталық белсенділік қорытындысы", "Үй тапсырмалары", "Баланың төлқұжаты"],
    purpose: "Бөбекжай мен отбасы арасындағы байланысты нығайту.",
    usedBy: ["Ата-ана"],
    appRoute: "/app/family",
    usage: { actions: "ата-ана мен бала байланысы", users: "қатысатын ата-ана" },
  },
  analytics: {
    emoji: "📊",
    name: "Эко Талдау",
    tagline: "Тәрбиешілерге арналған есептер",
    description:
      "Тәрбиеші өз тобының белсенділігін, ойындарға және зерттеулерге қатысуын, XP динамикасын көреді. Әр көрсеткішті басып, бала бойынша толық ақпаратты ашуға болады.",
    features: [
      "Белсенді балалар және белсенділік динамикасы",
      "Ойындар мен зерттеулер бойынша есеп",
      "Әр баланың жеке прогресі (тек өз тобы)",
      "AI оқу-ойын әрекетінің генераторы",
    ],
    purpose: "Тәрбиешіге топты жүйелі бақылап, жұмысты жоспарлауға көмектесу.",
    usedBy: ["Тәрбиеші"],
    appRoute: "/app/analytics",
    usage: { actions: "AI жасаған оқу-ойын әрекеті", users: "белсенді тәрбиеші" },
  },
};

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}
