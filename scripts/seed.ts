/**
 * Seeds one demo school with every role, plus enough sample content
 * (species, games, achievements, research, greenhouse entries, a
 * lesson) for every module in the app to have something real to show.
 * Idempotent: re-running clears previously-seeded (is_demo = true)
 * rows first, rather than erroring on unique-constraint conflicts.
 *
 * Connects with DATABASE_URL (admin) — never APP_DATABASE_URL — the
 * same reasoning as scripts/migrate.ts.
 *
 * No real children's names or personal data are used anywhere below;
 * every seeded child/parent is a clearly-labelled fictional demo
 * persona.
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { ECOGAMES, ECOGAME_ACHIEVEMENTS } from "./seed-data/ecogames";

config({ path: ".env.local" });
config();

const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }
  const sql = postgres(connectionString, { max: 1 });

  try {
    console.log("→ clearing previously seeded demo data...");
    await sql`delete from schools where id in (select school_id from users where is_demo = true)`;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const pinHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    console.log("→ creating school...");
    const [school] = await sql<{ id: string }[]>`
      insert into schools (name, region, default_locale, plan)
      values ('Демо балабақша №1 "Еркетай"', 'Алматы облысы', 'kk', 'growth')
      returning id
    `;

    console.log("→ creating group...");
    const [group] = await sql<{ id: string }[]>`
      insert into groups (school_id, name, age_band, locale, code, age_category)
      values (${school.id}, 'Күншуақ тобы', '5-6', 'kk', 'KUN-01', 'PRESCHOOL_5')
      returning id
    `;

    // Three demo groups covering all three age categories (spec §15) —
    // left without an educator/assistant since the only demo teacher is
    // already the primary educator of "Күншуақ тобы" above; assigning
    // them here too would change getPrimaryGroup()'s "first group"
    // result and break existing teacher-cabinet assertions.
    await sql`
      insert into groups (school_id, name, age_band, locale, code, age_category)
      values
        (${school.id}, 'Балапан тобы', '3-4', 'kk', 'ORTA-01', 'MIDDLE_3'),
        (${school.id}, 'Қарлығаш тобы', '4-5', 'kk', 'ERESEK-01', 'SENIOR_4'),
        (${school.id}, 'Болашақ тобы', '5-6', 'kk', 'MAD-01', 'PRESCHOOL_5')
    `;

    console.log("→ creating users...");
    const [superAdmin] = await sql<{ id: string }[]>`
      insert into users (school_id, role, email, password_hash, display_name, locale, is_demo)
      values (${school.id}, 'SUPER_ADMIN', 'superadmin@ecostart.local', ${passwordHash}, 'Платформа әкімшісі (демо)', 'kk', true)
      returning id
    `;
    const [admin] = await sql<{ id: string }[]>`
      insert into users (school_id, role, email, password_hash, display_name, locale, is_demo)
      values (${school.id}, 'SCHOOL_ADMIN', 'admin@ecostart.local', ${passwordHash}, 'Балабақша меңгерушісі (демо)', 'kk', true)
      returning id
    `;
    const [teacher] = await sql<{ id: string }[]>`
      insert into users (school_id, role, email, password_hash, display_name, locale, group_id, is_demo)
      values (${school.id}, 'TEACHER', 'teacher@ecostart.local', ${passwordHash}, 'Айгүл тәрбиеші (демо)', 'kk', ${group.id}, true)
      returning id
    `;
    await sql`insert into teacher_groups (teacher_id, group_id) values (${teacher.id}, ${group.id})`;

    const [parent] = await sql<{ id: string }[]>`
      insert into users (school_id, role, email, password_hash, display_name, locale, is_demo)
      values (${school.id}, 'PARENT', 'parent@ecostart.local', ${passwordHash}, 'Демо ата-ана', 'kk', true)
      returning id
    `;

    // Three demo children. Only the first is the documented, directly
    // loggable "child@ecostart.local" account; all three use PINs
    // hashed from the same shared demo password for simplicity.
    const [child1] = await sql<{ id: string }[]>`
      insert into users (school_id, role, login_code, pin_hash, display_name, avatar_url, locale, birth_year, group_id, xp, level, is_demo)
      values (${school.id}, 'CHILD', 'child@ecostart.local', ${pinHash}, 'Демо бала — Айым', '🦉', 'kk', 2020, ${group.id}, 230, 3, true)
      returning id
    `;
    const [child2] = await sql<{ id: string }[]>`
      insert into users (school_id, role, login_code, pin_hash, display_name, avatar_url, locale, birth_year, group_id, xp, level, is_demo)
      values (${school.id}, 'CHILD', 'demo-child-2', ${pinHash}, 'Демо бала — Ерлан', '🐢', 'kk', 2019, ${group.id}, 120, 2, true)
      returning id
    `;
    const [child3] = await sql<{ id: string }[]>`
      insert into users (school_id, role, login_code, pin_hash, display_name, avatar_url, locale, birth_year, group_id, xp, level, is_demo)
      values (${school.id}, 'CHILD', 'demo-child-3', ${pinHash}, 'Демо бала — Дана', '🦋', 'kk', 2020, ${group.id}, 40, 1, true)
      returning id
    `;

    await sql`
      insert into parent_child_links (parent_id, child_id, relation, consent_at)
      values
        (${parent.id}, ${child1.id}, 'parent', now()),
        (${parent.id}, ${child2.id}, 'parent', now())
    `;

    console.log("→ seeding species encyclopedia...");
    // Global reference content (species/games/achievements) has no
    // school_id, so it survives the demo-school wipe above — reseed
    // idempotently instead of assuming an empty table.
    await sql`delete from recognitions`; // FK's to species; safe to clear along with the rest of demo data
    await sql`delete from species`;
    const speciesRows = await sql<{ id: string; kind: string }[]>`
      insert into species (kind, common_name, latin_name, facts, is_toxic, caution_note)
      values
        ('PLANT', '{"kk":"Дала ромашкасы","ru":"Ромашка","en":"Chamomile"}', 'Matricaria chamomilla',
          '["Гүлдері дәрі шайға қолданылады.","Жазда далада көп өседі."]', false, null),
        ('PLANT', '{"kk":"Күнбағыс","ru":"Подсолнух","en":"Sunflower"}', 'Helianthus annuus',
          '["Күн бағытына қарай бұрылады.","Тұқымынан май жасалады."]', false, null),
        ('LEAF', '{"kk":"Емен жапырағы","ru":"Дубовый лист","en":"Oak leaf"}', 'Quercus robur',
          '["Күзде қоңыр түске енеді.","Емен 100 жылдан астам өмір сүреді."]', false, null),
        ('ANIMAL', '{"kk":"Көбелек","ru":"Бабочка","en":"Butterfly"}', 'Rhopalocera',
          '["Гүлдерді тозаңдандырады.","Бастапқыда құрттан пайда болады."]', false, null),
        ('ANIMAL', '{"kk":"Қоңыз","ru":"Жук","en":"Beetle"}', 'Coleoptera',
          '["Дүниежүзінде миллионнан астам түрі бар."]', false, null),
        ('PLANT', '{"kk":"Қызыл мұқыт саңырауқұлақ","ru":"Мухомор","en":"Fly agaric mushroom"}', 'Amanita muscaria',
          '["Түсі қызыл, үстінде ақ дақтар бар."]', true, '{"kk":"Бұл саңырауқұлақ уытты — ешқашан жеме!","ru":"Этот гриб ядовит — никогда не ешь его!","en":"This mushroom is toxic — never eat it!"}'),
        ('OBJECT', '{"kk":"Су құты","ru":"Лейка","en":"Watering can"}', null,
          '["Өсімдіктерді суғаруға арналған."]', false, null),
        ('PLANT', '{"kk":"Алма ағашы","ru":"Яблоня","en":"Apple tree"}', 'Malus domestica',
          '["Көктемде гүлдейді, күзде жеміс береді."]', false, null)
      returning id, kind
    `;

    console.log("→ seeding games...");
    await sql`delete from games`; // global reference content; cascades any leftover game_sessions
    const [wasteGame] = await sql<{ id: string }[]>`
      insert into games (key, title, description, config, icon, color, difficulty, age_min, age_max, xp_reward, badge_key, template, display_order)
      values (
        'waste_sorting',
        '{"kk":"Қоқысты сұрыптау","ru":"Сортировка мусора","en":"Waste Sorting"}',
        '{"kk":"Қоқысты дұрыс себетке тастап үйрен!","ru":"Учись сортировать мусор по правильным бакам!","en":"Learn to sort waste into the right bins!"}',
        '{"bins":["paper","plastic","glass","organic"]}',
        'Trophy', 'var(--module-game)', 'easy', 4, 6, 30, 'waste_sorting_pro', 'drag_sort', 0
      )
      returning id
    `;

    // 14 more EcoGame games, reusing 5 shared interaction engines
    // (see src/lib/domain/game-templates) — content lives in
    // scripts/seed-data/ecogames.ts to keep this file readable.
    for (const g of ECOGAMES) {
      await sql`
        insert into games (key, title, description, config, icon, color, difficulty, age_min, age_max, xp_reward, badge_key, template, display_order)
        values (
          ${g.key}, ${sql.json(g.title)}, ${sql.json(g.description)}, ${sql.json(g.config as postgres.JSONValue)},
          ${g.icon}, ${g.color}, ${g.difficulty}, ${g.ageMin}, ${g.ageMax}, ${g.xpReward}, ${g.badgeKey}, ${g.template}, ${g.order}
        )
      `;
    }

    // Sample age-category tagging: 1 representative game per category
    // (the simplest one-tap game for the youngest group, a comparison
    // quiz for the middle group, a multi-step assembly game for the
    // oldest — matching the age-appropriate-complexity guidance in the
    // approved groups-module plan). The other 14 games keep the default
    // empty age_categories ("барлық санат") so nothing already visible
    // to every child disappears — full per-game curation is a follow-up
    // once a games-authoring admin UI exists.
    await sql`update games set age_categories = '{MIDDLE_3}' where key = 'water-the-flower'`;
    await sql`update games set age_categories = '{SENIOR_4}' where key = 'plant-needs'`;
    await sql`update games set age_categories = '{PRESCHOOL_5}' where key = 'nature-puzzle'`;

    console.log("→ seeding achievements...");
    await sql`delete from achievements`; // global reference content; cascades any leftover child_achievements
    const achievementRows = await sql<{ id: string; key: string }[]>`
      insert into achievements (key, title, description, icon, xp_reward)
      values
        ('first_steps', '{"kk":"Алғашқы қадам","ru":"Первый шаг","en":"First Steps"}', '{"kk":"Бірінші тапсырманы орындады","ru":"Выполнил первое задание","en":"Completed the first activity"}', 'footprints', 10),
        ('botanist', '{"kk":"Кіші ботаник","ru":"Юный ботаник","en":"Young Botanist"}', '{"kk":"5 өсімдікті танып білді","ru":"Распознал 5 растений","en":"Identified 5 plants"}', 'flower-2', 30),
        ('water_guardian', '{"kk":"Су сақшысы","ru":"Хранитель воды","en":"Water Guardian"}', '{"kk":"Өсімдікті тұрақты суғарды","ru":"Регулярно поливал растение","en":"Watered a plant consistently"}', 'droplets', 20),
        ('researcher', '{"kk":"Кіші зерттеуші","ru":"Юный исследователь","en":"Young Researcher"}', '{"kk":"Зерттеу жобасын аяқтады","ru":"Завершил исследовательский проект","en":"Completed a research project"}', 'microscope', 40),
        ('green_hero', '{"kk":"Жасыл батыр","ru":"Зелёный герой","en":"Green Hero"}', '{"kk":"3-деңгейге жетті","ru":"Достиг 3 уровня","en":"Reached level 3"}', 'award', 25),
        ('waste_sorting_pro', '{"kk":"Қоқыс сарапшысы","ru":"Эксперт по сортировке","en":"Sorting Expert"}', '{"kk":"«Қоқысты сұрыптау» ойынында жоғары нәтиже көрсетті","ru":"Показал(а) отличный результат в игре «Сортировка мусора»","en":"Scored high in Waste Sorting"}', 'recycle', 15)
      returning id, key
    `;

    for (const a of ECOGAME_ACHIEVEMENTS) {
      const [row] = await sql<{ id: string; key: string }[]>`
        insert into achievements (key, title, description, icon, xp_reward)
        values (${a.key}, ${sql.json(a.title)}, ${sql.json(a.description)}, ${a.icon}, ${a.xpReward})
        returning id, key
      `;
      achievementRows.push(row);
    }

    const findAch = (key: string) => achievementRows.find((a) => a.key === key)!.id;
    await sql`
      insert into child_achievements (child_id, achievement_id)
      values
        (${child1.id}, ${findAch("first_steps")}),
        (${child1.id}, ${findAch("botanist")}),
        (${child1.id}, ${findAch("green_hero")}),
        (${child2.id}, ${findAch("first_steps")}),
        (${child2.id}, ${findAch("water_guardian")})
    `;

    console.log("→ seeding certificates...");
    await sql`
      insert into certificates (school_id, child_id, title, reason, issued_at)
      values (
        ${school.id}, ${child1.id},
        '{"kk":"Табиғат досы сертификаты","ru":"Сертификат друга природы","en":"Friend of Nature Certificate"}',
        'EcoLab-та 5 өсімдікті танып білгені үшін',
        now() - interval '3 days'
      )
    `;

    console.log("→ seeding greenhouse entries + growth logs...");
    const sunflowerSpecies = speciesRows.find((s) => s.kind === "PLANT")!.id;
    const [entry1] = await sql<{ id: string }[]>`
      insert into greenhouse_entries (child_id, species_id, nickname, planted_at, water_schedule, last_watered_at, status)
      values (${child1.id}, ${sunflowerSpecies}, 'Менің күнбағысым', current_date - interval '21 days', 'every_2_days', current_date - interval '1 day', 'active')
      returning id
    `;
    await sql`
      insert into growth_logs (entry_id, logged_at, height_cm, note)
      values
        (${entry1.id}, current_date - interval '18 days', 2.5, 'Алғашқы өскін шықты'),
        (${entry1.id}, current_date - interval '14 days', 5.0, null),
        (${entry1.id}, current_date - interval '10 days', 9.5, 'Жапырақтар пайда болды'),
        (${entry1.id}, current_date - interval '6 days', 14.0, null),
        (${entry1.id}, current_date - interval '2 days', 19.5, 'Тез өсіп жатыр!')
    `;

    console.log("→ seeding research project...");
    const [project] = await sql<{ id: string }[]>`
      insert into research_projects (group_id, created_by, title, question, hypothesis, measurement_unit, status)
      values (
        ${group.id}, ${teacher.id},
        'Қай өсімдік тезірек өседі: күн астында ма, көлеңкеде ме?',
        'Күн сәулесі өсімдіктің өсуіне қалай әсер етеді?',
        'Күн астындағы өсімдік көлеңкедегіден тезірек өседі деп ойлаймыз.',
        'cm', 'active'
      )
      returning id
    `;
    await sql`
      insert into research_observations (project_id, child_id, logged_at, measurement, note)
      values
        (${project.id}, ${child1.id}, current_date - interval '12 days', 1.0, 'Тұқым септік'),
        (${project.id}, ${child1.id}, current_date - interval '8 days', 3.5, 'Күн астында'),
        (${project.id}, ${child1.id}, current_date - interval '4 days', 7.0, 'Күн астында'),
        (${project.id}, ${child2.id}, current_date - interval '12 days', 1.0, 'Тұқым септік'),
        (${project.id}, ${child2.id}, current_date - interval '8 days', 2.0, 'Көлеңкеде'),
        (${project.id}, ${child2.id}, current_date - interval '4 days', 3.2, 'Көлеңкеде')
    `;

    console.log("→ seeding a sample lesson...");
    const [lesson] = await sql<{ id: string }[]>`
      insert into lessons (school_id, author_id, topic, locale, age_band, status)
      values (${school.id}, ${teacher.id}, 'Су циклы', 'kk', '5-6', 'published')
      returning id
    `;
    await sql`
      insert into lesson_artifacts (lesson_id, type, content, ai_is_mock)
      values
        (${lesson.id}, 'LESSON_PLAN', '{"objective":"Балалар су циклын түсінеді","plan":["Кіріспе әңгіме","Видео көрсету","Тәжірибе","Талқылау"]}', true),
        (${lesson.id}, 'QUIZ', '{"questions":[{"question":"Су бу болғанда не болады?","options":["Бұлт жасайды","Жоғалады","Түс өзгертеді"],"correctIndex":0}]}', true)
    `;
    await sql`
      insert into lesson_assignments (lesson_id, group_id, due_at)
      values (${lesson.id}, ${group.id}, current_date + interval '5 days')
    `;

    console.log("→ seeding game sessions (for analytics)...");
    await sql`
      insert into game_sessions (child_id, game_id, started_at, ended_at, score, correct_count, total_count, xp_earned)
      values
        (${child1.id}, ${wasteGame.id}, now() - interval '5 days', now() - interval '5 days' + interval '4 minutes', 50, 5, 6, 25),
        (${child1.id}, ${wasteGame.id}, now() - interval '2 days', now() - interval '2 days' + interval '3 minutes', 60, 6, 6, 30),
        (${child2.id}, ${wasteGame.id}, now() - interval '3 days', now() - interval '3 days' + interval '5 minutes', 40, 4, 6, 20)
    `;

    console.log("→ seeding recognitions (EcoLab journal)...");
    await sql`
      insert into recognitions (child_id, species_id, kind, image_url, confidence, ai_provider, ai_is_mock, ai_summary)
      values
        (${child1.id}, ${speciesRows[0].id}, 'PLANT', '/uploads/demo/chamomile.svg', 0.88, 'mock', true, '{"funFact":"Ромашка шайы тыныштандырады."}'),
        (${child1.id}, ${speciesRows[3].id}, 'ANIMAL', '/uploads/demo/butterfly.svg', 0.91, 'mock', true, '{"funFact":"Көбелектер гүлдерді тозаңдандырады."}')
    `;

    console.log("→ seeding a notification + a chat thread...");
    await sql`
      insert into notifications (user_id, type, payload)
      values (${parent.id}, 'weekly_report', '{"childName":"Айым","xpGained":45}')
    `;
    const [thread] = await sql<{ id: string }[]>`
      insert into chat_threads (user_id, kind) values (${child1.id}, 'nature_chat') returning id
    `;
    await sql`
      insert into chat_messages (thread_id, sender, content)
      values
        (${thread.id}, 'user', 'Неге аспан көк?'),
        (${thread.id}, 'assistant', 'Керемет сұрақ! ☀️ Күн сәулесі ауамен түйіскенде көк түс көбірек шашырайды.')
    `;

    // ── CMS default content ──────────────────────────────────────────
    // Deliberately NOT tied to the demo-school wipe above: this is
    // baseline platform content (what SUPER_ADMIN sees/edits in Website
    // Management), not disposable demo data. `on conflict ... do
    // nothing` means re-running `npm run db:seed` never clobbers a real
    // admin's live edits — it only fills in defaults the first time.
    console.log("→ seeding default website content (brand, theme, banners, sections, modules, role cards)...");

    await sql`insert into brand_settings (status) values ('published') on conflict (status) do nothing`;
    await sql`insert into theme_settings (status) values ('published') on conflict (status) do nothing`;

    // The old singleton `homepage_banner` table is no longer read or
    // written by the app — the public hero is now the rotating
    // `homepage_banners` carousel seeded below. The table itself is
    // left in place (see migration 0009's header comment) but nothing
    // seeds it anymore.

    type BannerSeed = {
      order: number;
      content: { title: string; subtitle: string; description: string; primaryButtonText: string; secondaryButtonText: string };
      primaryLink: string;
    };

    const banners: BannerSeed[] = [
      {
        order: 0,
        primaryLink: "/login",
        content: {
          title: "Табиғатты ойын арқылы таны",
          subtitle: "",
          description: "Балалар экологияны сурет, дыбыс және қызықты ойындар арқылы үйренеді.",
          primaryButtonText: "Ойнауды бастау",
          secondaryButtonText: "",
        },
      },
      {
        order: 1,
        primaryLink: "/#modules",
        content: {
          title: "Әр балаға — жасыл болашақ",
          subtitle: "",
          description: "Өсімдікті бақыла, табиғатты зертте және пайдалы экологиялық әдеттерді қалыптастыр.",
          primaryButtonText: "Модульдерді көру",
          secondaryButtonText: "",
        },
      },
      {
        order: 2,
        primaryLink: "/login",
        content: {
          title: "Тәрбиешіге көмек, балаға қызықты тәжірибе",
          subtitle: "",
          description: "Оқу-ойын әрекеттерін жоспарлау, топ жетістіктерін бақылау және ата-анамен байланыс.",
          primaryButtonText: "Жүйеге кіру",
          secondaryButtonText: "",
        },
      },
    ];

    for (const b of banners) {
      const content = { kk: b.content, ru: b.content, en: b.content };
      await sql`
        insert into homepage_banners (status, enabled, display_order, content, primary_button_link)
        select 'published', true, ${b.order}, ${sql.json(content)}, ${b.primaryLink}
        where not exists (select 1 from homepage_banners where display_order = ${b.order} and status = 'published')
      `;
    }

    console.log("→ seeding news articles...");
    type NewsSeed = {
      order: number;
      slug: string;
      title: string;
      excerpt: string;
      body: string;
      category: "events" | "eco_projects" | "child_achievements" | "teacher_news" | "for_parents" | "announcements";
      author: string;
      daysAgo: number;
    };

    const newsArticles: NewsSeed[] = [
      {
        order: 0,
        slug: "zhas-ekologtar-kuni",
        title: "Жас экологтар күні",
        excerpt: "Бөбекжайымызда «Жас экологтар күні» аясында балалар табиғатты танып-білуге арналған қызықты іс-шараларға қатысты.",
        body: "Бүгін №37 «Жұлдыз-ай» бөбекжайында «Жас экологтар күні» өтті. Балалар топ бойынша экологиялық ойындар ойнады, өсімдіктер мен жәндіктер туралы қызықты фактілермен танысты және өз қолдарымен шағын гербарий жасады.\n\nТәрбиешілер табиғатты қорғаудың маңыздылығы туралы қарапайым да түсінікті тілде әңгімелеп берді. Іс-шара соңында әр балаға кішкентай сертификат пен көшет сыйға тартылды.",
        category: "events",
        author: "Айгүл тәрбиеші",
        daysAgo: 1,
      },
      {
        order: 1,
        slug: "balalar-gul-otyrgyzdy",
        title: "Балалар гүл отырғызды",
        excerpt: "Күншуақ тобының балалары бөбекжай ауласында гүл көшеттерін отырғызып, оларды бақылауды өз мойындарына алды.",
        body: "Жасыл бөбекжай жобасы аясында Күншуақ тобының балалары бөбекжай ауласындағы шағын клумбаға түрлі-түсті гүл көшеттерін отырғызды. Әр бала өз гүліне ат қойып, оны суғаруды және бақылауды өз міндетіне алды.\n\nБұл — балалардың жауапкершілік пен табиғатқа деген қамқорлықты кішкентай кезден үйренуіне арналған тұрақты жобаларымыздың бірі. Келесі апталарда гүлдердің қалай өсіп жатқанын осы жерден жаңалықтар арқылы бақылап отырыңыз.",
        category: "eco_projects",
        author: "Айгүл тәрбиеші",
        daysAgo: 5,
      },
      {
        order: 2,
        slug: "qaldyqtardy-suryptau-sabagy",
        title: "Қалдықтарды сұрыптау сабағы",
        excerpt: "Балалар қоқысты дұрыс сұрыптауды үйретуге арналған қызықты сабаққа қатысып, EcoGame ойынындағы білімдерін іс жүзінде қолданып көрді.",
        body: "Бөбекжайымызда өткен қалдықтарды сұрыптау сабағында балалар қағаз, пластик, шыны және органикалық қалдықтарды дұрыс себетке бөлуді үйренді. Сабақ ойын түрінде өтті — балалар алдымен «Эко Ойын» қосымшасындағы қоқысты сұрыптау ойынын ойнап, содан кейін нақты заттармен тәжірибе жасады.\n\nТәрбиешілер балалардың экологиялық сауаттылығын арттыруға осындай практикалық сабақтардың үлкен пайдасы бар екенін атап өтті.",
        category: "teacher_news",
        author: "Айгүл тәрбиеші",
        daysAgo: 9,
      },
    ];

    for (const n of newsArticles) {
      await sql`
        insert into news_items (status, enabled, featured_home, display_order, slug, title, excerpt, body, category, author, display_date)
        select 'published', true, true, ${n.order}, ${n.slug}, ${n.title}, ${n.excerpt}, ${n.body}, ${n.category}, ${n.author}, current_date - ${n.daysAgo}::int * interval '1 day'
        where not exists (select 1 from news_items where slug = ${n.slug} and status = 'published')
      `;
    }

    type SectionSeed = {
      key: string;
      order: number;
      enabled: boolean;
      layout: "standard" | "reverse" | "centered" | "grid";
      background: "default" | "muted" | "primary" | "gradient";
      content: Record<"kk" | "ru" | "en", { title: string; subtitle: string; description: string; buttonText: string }>;
      buttonLink: string | null;
    };

    const sections: SectionSeed[] = [
      {
        key: "hero",
        order: 0,
        enabled: true,
        layout: "centered",
        background: "default",
        buttonLink: "/login",
        content: {
          kk: { title: "Басты баннер", subtitle: "", description: "Бұл бөлім «Баннер» редакторы арқылы басқарылады.", buttonText: "Кіру" },
          ru: { title: "Главный баннер", subtitle: "", description: "Этот раздел управляется через редактор «Баннер».", buttonText: "Войти" },
          en: { title: "Main banner", subtitle: "", description: "This section is managed via the Banner editor.", buttonText: "Log in" },
        },
      },
      {
        key: "intro",
        order: 1,
        enabled: true,
        layout: "standard",
        background: "default",
        buttonLink: "/#modules",
        content: {
          kk: {
            title: "Табиғатты бірге зерттейміз",
            subtitle: "AI негізінде білім беру",
            description:
              "«Эко Start» — мектепке дейінгі мекемелерге арналған алғашқы жасанды интеллект платформасы. Ол зертхана, ойын, шығармашылық және отбасы модульдерін бір орталық Эко Көмекшімен біріктіреді.",
            buttonText: "Мүмкіндіктерді көру",
          },
          ru: {
            title: "Исследуем природу вместе",
            subtitle: "Образование на основе ИИ",
            description:
              "Eco Start AI — первая платформа искусственного интеллекта для дошкольных учреждений. Она объединяет лабораторию, игры, творчество и модули для семьи вокруг одного центрального AI-помощника.",
            buttonText: "Посмотреть возможности",
          },
          en: {
            title: "Discover nature, together",
            subtitle: "AI-powered learning",
            description:
              "Eco Start AI is the first artificial intelligence platform built for preschools — a lab, games, creativity, and family modules, all powered by one central Eco AI assistant.",
            buttonText: "See what's inside",
          },
        },
      },
      {
        key: "modules",
        order: 2,
        enabled: true,
        layout: "grid",
        background: "default",
        buttonLink: null,
        content: {
          kk: { title: "«Эко Start» цифрлық орталығының модульдері", subtitle: "", description: "Балаларға, тәрбиешілерге және ата-аналарға арналған", buttonText: "" },
          ru: { title: "Восемь модулей, один разум ИИ", subtitle: "", description: "Каждый модуль подключён к единому Eco AI помощнику — для детей, воспитателей и родителей", buttonText: "" },
          en: { title: "Eight modules, one AI mind", subtitle: "", description: "Every module connects to the same Eco AI assistant — for children, teachers, and parents", buttonText: "" },
        },
      },
      {
        key: "eco_ai",
        order: 3,
        enabled: false,
        layout: "reverse",
        background: "muted",
        buttonLink: null,
        content: {
          kk: {
            title: "Эко Көмекші — платформаның жүрегі",
            subtitle: "",
            description:
              "Сурет тану, әңгіме, оқу-ойын әрекетінің жоспарын жасау, ертегі жазу — барлығы бір қауіпсіз, жасқа сай AI жүйесі арқылы жұмыс істейді. Балаларға арналған жауаптар әрдайым қарапайым тілде және қауіпсіздік ескертулерімен беріледі.",
            buttonText: "",
          },
          ru: {
            title: "Eco AI — сердце платформы",
            subtitle: "",
            description:
              "Распознавание по фото, диалог, создание плана урока, написание сказки — всё работает через одну безопасную, подходящую по возрасту AI-систему. Ответы для детей всегда даются простым языком с предупреждениями о безопасности.",
            buttonText: "",
          },
          en: {
            title: "Eco AI — the heart of the platform",
            subtitle: "",
            description:
              "Photo recognition, conversation, lesson-plan generation, story writing — all powered by one safe, age-appropriate AI system. Responses for children always use simple language and safety warnings.",
            buttonText: "",
          },
        },
      },
      {
        key: "roles",
        order: 4,
        enabled: true,
        layout: "grid",
        background: "default",
        buttonLink: null,
        content: {
          kk: { title: "Тәжірибеден — нәтижеге", subtitle: "", description: "Бала, тәрбиеші, ата-ана және әкімші — әрқайсысына арналған жеке тәжірибе", buttonText: "" },
          ru: { title: "Свой опыт для каждой роли", subtitle: "", description: "Ребёнок, воспитатель, родитель и администратор — у каждого свой личный кабинет", buttonText: "" },
          en: { title: "A tailored experience for every role", subtitle: "", description: "Child, teacher, parent, and admin — each with their own dedicated experience", buttonText: "" },
        },
      },
      {
        key: "results",
        order: 5,
        enabled: false,
        layout: "centered",
        background: "primary",
        buttonLink: null,
        content: {
          kk: {
            title: "Күтілетін нәтижелер",
            subtitle: "",
            description:
              "Тәрбиешілердің оқу-ойын әрекетіне дайындалу уақыты 10 еседен астам қысқарады, балалар апта сайын белсенді ойнап-үйренеді, ал ата-аналар балаларының жетістіктерінен үнемі хабардар болады.",
            buttonText: "",
          },
          ru: {
            title: "Ожидаемые результаты",
            subtitle: "",
            description:
              "Время подготовки воспитателя к занятию сокращается более чем в 10 раз, дети еженедельно активно играют и учатся, а родители всегда в курсе успехов своего ребёнка.",
            buttonText: "",
          },
          en: {
            title: "Expected results",
            subtitle: "",
            description:
              "Teacher lesson-prep time drops more than 10x, children stay actively engaged every week, and parents always know how their child is doing.",
            buttonText: "",
          },
        },
      },
      {
        key: "cta",
        order: 6,
        enabled: false,
        layout: "centered",
        background: "gradient",
        buttonLink: "/login",
        content: {
          kk: {
            title: "Бөбекжайыңызды «Эко Start»-қа қосыңыз",
            subtitle: "",
            description: "Бүгін бастаңыз — демо тіркелгілермен барлық мүмкіндікті тегін көріңіз.",
            buttonText: "Қазір бастау",
          },
          ru: {
            title: "Подключите свой детский сад к Eco Start AI",
            subtitle: "",
            description: "Начните сегодня — посмотрите все возможности бесплатно через демо-аккаунты.",
            buttonText: "Начать сейчас",
          },
          en: {
            title: "Bring Eco Start AI to your school",
            subtitle: "",
            description: "Start today — explore every feature for free with the demo accounts.",
            buttonText: "Get started",
          },
        },
      },
      {
        key: "footer",
        order: 7,
        enabled: true,
        layout: "standard",
        background: "default",
        buttonLink: null,
        content: {
          kk: { title: "Эко Start", subtitle: "", description: "Бұл — мектепке дейінгі білім беру бәйгесіне арналған демонстрациялық платформа.", buttonText: "" },
          ru: { title: "Eco Start AI", subtitle: "", description: "Это демонстрационная платформа для конкурса по дошкольному образованию.", buttonText: "" },
          en: { title: "Eco Start AI", subtitle: "", description: "This is a demonstration platform built for a preschool-education competition.", buttonText: "" },
        },
      },
    ];

    for (const s of sections) {
      await sql`
        insert into homepage_sections (key, status, enabled, display_order, content, button_link, background_style, layout)
        values (${s.key}, 'published', ${s.enabled}, ${s.order}, ${sql.json(s.content)}, ${s.buttonLink}, ${s.background}, ${s.layout})
        on conflict (key, status) do nothing
      `;
    }

    type ModuleSeed = {
      key: string;
      order: number;
      icon: string;
      color: string;
      route: string;
      roles: string[];
      content: Record<"kk" | "ru" | "en", { title: string; description: string }>;
    };

    const modules: ModuleSeed[] = [
      { key: "ecolab", order: 0, icon: "Camera", color: "var(--module-ecolab)", route: "/app/ecolab", roles: ["CHILD"],
        content: {
          kk: { title: "Эко Зертхана", description: "Сурет арқылы өсімдік пен жануарларды танып-білу" },
          ru: { title: "EcoLab AI", description: "Распознавание растений и животных по фото с помощью ИИ" },
          en: { title: "EcoLab AI", description: "AI-powered plant and animal recognition from photos" },
        } },
      { key: "greenhouse", order: 1, icon: "Sprout", color: "var(--module-greenhouse)", route: "/app/greenhouse", roles: ["CHILD"],
        content: {
          kk: { title: "Жасыл бөбекжай", description: "Өсімдікті бақылау, суару және өсу тарихын жүргізу" },
          ru: { title: "Зелёный детский сад", description: "Дневник растений и история роста" },
          en: { title: "Green Kindergarten", description: "Plant diary and growth history" },
        } },
      { key: "game", order: 2, icon: "Trophy", color: "var(--module-game)", route: "/app/games", roles: ["CHILD"],
        content: {
          kk: { title: "Эко Ойын", description: "Экологияны сурет, дыбыс және ойын арқылы үйрену" },
          ru: { title: "EcoGame", description: "Сортировка мусора и другие экологические игры" },
          en: { title: "EcoGame", description: "Waste sorting and other environmental games" },
        } },
      { key: "media", order: 3, icon: "Palette", color: "var(--module-media)", route: "/app/media", roles: ["CHILD"],
        content: {
          kk: { title: "Эко Медиа шеберханасы", description: "Ертегі, сурет және оқиға жасау" },
          ru: { title: "EcoMedia Studio", description: "Создание сказок и раскадровок с помощью ИИ" },
          en: { title: "EcoMedia Studio", description: "AI-assisted story and storyboard creation" },
        } },
      { key: "research", order: 4, icon: "LineChart", color: "var(--module-research)", route: "/app/research", roles: ["CHILD", "TEACHER"],
        content: {
          kk: { title: "Эко Зерттеу", description: "Қарапайым тәжірибелер мен табиғатты бақылау" },
          ru: { title: "EcoResearch", description: "Мини исследовательские проекты и графики" },
          en: { title: "EcoResearch", description: "Mini research projects and charts" },
        } },
      { key: "passport", order: 5, icon: "GraduationCap", color: "var(--module-passport)", route: "/app/passport", roles: ["CHILD", "PARENT"],
        content: {
          kk: { title: "Эко Төлқұжат", description: "Жетістіктер, белгілер және марапаттар" },
          ru: { title: "EcoPassport", description: "XP, значки и сертификаты" },
          en: { title: "EcoPassport", description: "XP, badges, and certificates" },
        } },
      { key: "family", order: 6, icon: "UsersRound", color: "var(--module-family)", route: "/app/family", roles: ["PARENT"],
        content: {
          kk: { title: "Эко Отбасы", description: "Ата-анаға арналған баланың даму көрсеткіштері" },
          ru: { title: "EcoFamily", description: "Прогресс ребёнка для родителей" },
          en: { title: "EcoFamily", description: "A parent's view of their child's progress" },
        } },
      { key: "analytics", order: 7, icon: "BarChart3", color: "var(--module-analytics)", route: "/app/analytics", roles: ["TEACHER"],
        content: {
          kk: { title: "Эко Талдау", description: "Тәрбиешілерге арналған есептер" },
          ru: { title: "EcoAnalytics", description: "Отчёты для воспитателей" },
          en: { title: "EcoAnalytics", description: "Reports for teachers" },
        } },
    ];

    for (const m of modules) {
      await sql`
        insert into homepage_modules (key, status, enabled, display_order, icon, color, content, route, allowed_roles)
        values (${m.key}, 'published', true, ${m.order}, ${m.icon}, ${m.color}, ${sql.json(m.content)}, ${m.route}, ${sql.json(m.roles)})
        on conflict (key, status) do nothing
      `;
    }

    type RoleCardSeed = {
      key: string;
      order: number;
      icon: string;
      color: string;
      route: string;
      content: Record<"kk" | "ru" | "en", { title: string; description: string }>;
    };

    const roleCards: RoleCardSeed[] = [
      { key: "CHILD", order: 0, icon: "Baby", color: "var(--module-ecolab)", route: "/app/child",
        content: {
          kk: { title: "Бала", description: "Ойын, зерттеу және табиғатты танып-білу" },
          ru: { title: "Ребёнок", description: "Игры, исследования и распознавание фото" },
          en: { title: "Child", description: "Games, research, and photo recognition" },
        } },
      { key: "TEACHER", order: 1, icon: "GraduationCap", color: "var(--module-research)", route: "/app/teacher",
        content: {
          kk: { title: "Тәрбиеші", description: "Жасанды интеллект көмегімен оқу-ойын әрекетін жоспарлау және топ нәтижелерін бақылау" },
          ru: { title: "Воспитатель", description: "AI генератор уроков и аналитика группы" },
          en: { title: "Teacher", description: "AI lesson generator and group analytics" },
        } },
      { key: "PARENT", order: 2, icon: "UsersRound", color: "var(--module-family)", route: "/app/parent",
        content: {
          kk: { title: "Ата-ана", description: "Баланың дамуы мен апталық жетістіктерін көру" },
          ru: { title: "Родитель", description: "Прогресс ребёнка и еженедельный отчёт" },
          en: { title: "Parent", description: "Your child's progress and weekly report" },
        } },
      { key: "SCHOOL_ADMIN", order: 3, icon: "ShieldCheck", color: "var(--module-passport)", route: "/app/admin",
        content: {
          kk: { title: "Әкімші", description: "Бөбекжайды, тәрбиешілерді және мазмұнды басқару" },
          ru: { title: "Администратор", description: "Управление школой, воспитателями и контентом" },
          en: { title: "Admin", description: "Manage your school, teachers, and content" },
        } },
    ];

    for (const r of roleCards) {
      await sql`
        insert into homepage_role_cards (key, status, enabled, display_order, icon, color, content, route)
        values (${r.key}, 'published', true, ${r.order}, ${r.icon}, ${r.color}, ${sql.json(r.content)}, ${r.route})
        on conflict (key, status) do nothing
      `;
    }

    console.log("\n✓ Seed complete.\n");
    console.log("Demo accounts (all use the same password):");
    console.log(`  Password: ${DEMO_PASSWORD}\n`);
    console.log("  superadmin@ecostart.local   (SUPER_ADMIN)");
    console.log("  admin@ecostart.local        (SCHOOL_ADMIN)");
    console.log("  teacher@ecostart.local      (TEACHER)");
    console.log("  parent@ecostart.local       (PARENT)");
    console.log("  child@ecostart.local        (CHILD, login code + PIN)");
    void superAdmin;
    void admin;
    void child3;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
