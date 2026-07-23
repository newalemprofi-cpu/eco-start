/**
 * One-time content correction for a database that was seeded BEFORE
 * this session's Kazakh-only / terminology / rebrand pass. `seed.ts`
 * inserts with `on conflict ... do nothing`, so re-running it never
 * overwrites already-published CMS rows — the old English module
 * names, "Мұғалім"/"Мектеп" copy, and old homepage headlines stay live
 * until something explicitly UPDATEs them. This script is that update,
 * run once by hand (not part of the normal seed flow). It touches only
 * the specific `content->kk` fields covered by the rebrand, matched by
 * `key`/`status` — never by raw row id — and disables (not deletes)
 * the three removed homepage sections. No demo school/user/game data
 * is touched.
 *
 * Connects with DATABASE_URL (admin), same as scripts/seed.ts.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }
  const sql = postgres(connectionString, { max: 1 });

  try {
    console.log("→ fixing brand name...");
    await sql`update brand_settings set site_name = 'Эко Start', short_name = 'Эко Start'`;

    console.log("→ fixing homepage_sections content + disabling removed sections...");
    const sectionPatches: { key: string; content: Record<string, unknown> }[] = [
      {
        key: "modules",
        content: {
          title: "«Эко Start» цифрлық орталығының модульдері",
          subtitle: "",
          description: "Балаларға, тәрбиешілерге және ата-аналарға арналған",
          buttonText: "",
        },
      },
      {
        key: "eco_ai",
        content: {
          title: "Эко Көмекші — платформаның жүрегі",
          subtitle: "",
          description:
            "Сурет тану, әңгіме, оқу-ойын әрекетінің жоспарын жасау, ертегі жазу — барлығы бір қауіпсіз, жасқа сай AI жүйесі арқылы жұмыс істейді. Балаларға арналған жауаптар әрдайым қарапайым тілде және қауіпсіздік ескертулерімен беріледі.",
          buttonText: "",
        },
      },
      {
        key: "roles",
        content: {
          title: "Тәжірибеден — нәтижеге",
          subtitle: "",
          description: "Бала, тәрбиеші, ата-ана және әкімші — әрқайсысына арналған жеке тәжірибе",
          buttonText: "",
        },
      },
      {
        key: "results",
        content: {
          title: "Күтілетін нәтижелер",
          subtitle: "",
          description:
            "Тәрбиешілердің оқу-ойын әрекетіне дайындалу уақыты 10 еседен астам қысқарады, балалар апта сайын белсенді ойнап-үйренеді, ал ата-аналар балаларының жетістіктерінен үнемі хабардар болады.",
          buttonText: "",
        },
      },
      {
        key: "cta",
        content: {
          title: "Бөбекжайыңызды «Эко Start»-қа қосыңыз",
          subtitle: "",
          description: "Бүгін бастаңыз — демо тіркелгілермен барлық мүмкіндікті тегін көріңіз.",
          buttonText: "Қазір бастау",
        },
      },
      {
        key: "footer",
        content: {
          title: "Эко Start",
          subtitle: "",
          description: "Бұл — мектепке дейінгі білім беру бәйгесіне арналған демонстрациялық платформа.",
          buttonText: "",
        },
      },
    ];
    for (const { key, content } of sectionPatches) {
      await sql`
        update homepage_sections
        set content = jsonb_set(content, '{kk}', ${JSON.stringify(content)}::jsonb)
        where key = ${key}
      `;
    }
    await sql`update homepage_sections set enabled = false where key in ('eco_ai', 'results', 'cta')`;

    console.log("→ fixing homepage_modules content...");
    const modulePatches: { key: string; title: string; description: string }[] = [
      { key: "ecolab", title: "Эко Зертхана", description: "Сурет арқылы өсімдік пен жануарларды танып-білу" },
      { key: "greenhouse", title: "Жасыл бөбекжай", description: "Өсімдікті бақылау, суару және өсу тарихын жүргізу" },
      { key: "game", title: "Эко Ойын", description: "Экологияны сурет, дыбыс және ойын арқылы үйрену" },
      { key: "media", title: "Эко Медиа шеберханасы", description: "Ертегі, сурет және оқиға жасау" },
      { key: "research", title: "Эко Зерттеу", description: "Қарапайым тәжірибелер мен табиғатты бақылау" },
      { key: "passport", title: "Эко Төлқұжат", description: "Жетістіктер, белгілер және марапаттар" },
      { key: "family", title: "Эко Отбасы", description: "Ата-анаға арналған баланың даму көрсеткіштері" },
      { key: "analytics", title: "Эко Талдау", description: "Тәрбиешілерге арналған есептер" },
    ];
    for (const { key, title, description } of modulePatches) {
      await sql`
        update homepage_modules
        set content = jsonb_set(jsonb_set(content, '{kk,title}', ${JSON.stringify(title)}::jsonb), '{kk,description}', ${JSON.stringify(description)}::jsonb)
        where key = ${key}
      `;
    }

    console.log("→ fixing homepage_role_cards content...");
    const roleCardPatches: { key: string; title: string; description: string }[] = [
      { key: "CHILD", title: "Бала", description: "Ойын, зерттеу және табиғатты танып-білу" },
      {
        key: "TEACHER",
        title: "Тәрбиеші",
        description: "Жасанды интеллект көмегімен оқу-ойын әрекетін жоспарлау және топ нәтижелерін бақылау",
      },
      { key: "PARENT", title: "Ата-ана", description: "Баланың дамуы мен апталық жетістіктерін көру" },
      { key: "SCHOOL_ADMIN", title: "Әкімші", description: "Бөбекжайды, тәрбиешілерді және мазмұнды басқару" },
    ];
    for (const { key, title, description } of roleCardPatches) {
      await sql`
        update homepage_role_cards
        set content = jsonb_set(jsonb_set(content, '{kk,title}', ${JSON.stringify(title)}::jsonb), '{kk,description}', ${JSON.stringify(description)}::jsonb)
        where key = ${key}
      `;
    }

    console.log("→ checking homepage_banners...");
    const [{ count }] = await sql<{ count: string }[]>`select count(*)::text as count from homepage_banners where status = 'published'`;
    if (Number(count) === 0) {
      console.log("  (none published yet — run `npm run db:seed` to insert the 3 default banners)");
    } else {
      console.log(`  ${count} published banner(s) already present, left as-is.`);
    }

    console.log("\n✓ Content fix complete.\n");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Content fix failed:", err);
  process.exit(1);
});
