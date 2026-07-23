/**
 * Generates 60 days of realistic-but-synthetic operational history for
 * the real imported children/teachers/groups: game sessions, XP/level,
 * Ecolab recognitions, Greenhouse entries + growth logs, one research
 * project per group with observations, achievements, notifications,
 * chat threads, teacher-authored lessons + assignments, and audit log
 * entries. Deterministic (fixed PRNG seed) so re-running the import
 * produces the same synthetic data — required for idempotency.
 *
 * Called once from scripts/import-private-data.ts, inside the same
 * transaction as the real people/groups import. Every row this module
 * writes is reachable only from this one call site — nothing here is
 * labeled "demo"/"synthetic" in any user-visible string (per the import
 * spec), but the *source* is fully isolated to this file for anyone
 * auditing the codebase later.
 */
import type postgres from "postgres";
import type { GroupAgeCategory } from "@/lib/group-age-categories";
import { levelForXp } from "@/lib/domain/xp";

function mulberry32(seed: number) {
  let s = seed | 0;
  return function random(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function daysAgoToDate(today: Date, daysAgo: number, rng: () => number): Date {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(8 + Math.floor(rng() * 10), Math.floor(rng() * 60), 0, 0);
  return d;
}

export type SyntheticChild = {
  id: string;
  groupId: string;
  ageCategory: GroupAgeCategory;
  sourceImportKey: string;
};

export type SyntheticTeacher = {
  id: string;
  groupId: string;
  ageCategory: GroupAgeCategory;
};

export type SyntheticGame = {
  id: string;
  key: string;
  xpReward: number;
  badgeKey: string | null;
  ageCategories: GroupAgeCategory[];
};

export type SyntheticActivityInput = {
  schoolId: string;
  days: number;
  children: SyntheticChild[];
  teachers: SyntheticTeacher[];
  species: { id: string; kind: "PLANT" | "ANIMAL" | "LEAF" | "OBJECT" }[];
  achievements: { id: string; key: string }[];
  games: SyntheticGame[];
};

const PLANT_NICKNAMES = ["Күнбағысым", "Раушаным", "Жапырағым", "Гүлайым", "Балдырған", "Жасылым"];
const CHAT_OPENERS = [
  "Аю неге қыста ұйықтайды?",
  "Гүлдер неге әр түрлі түсті болады?",
  "Құстар неге ұшады?",
  "Су неге мұзға айналады?",
];
const CHAT_REPLIES = [
  "Өте қызық сұрақ! Табиғатта мұның себебі бар — бірге зерттеп көрейік.",
  "Жақсы байқағансың! Бұл жайлы Эко Зертханада көбірек біле аласың.",
  "Керемет сұрақ! Табиғат әрдайым бізге жаңа нәрсе үйретеді.",
];

function eligibleGames(games: SyntheticGame[], category: GroupAgeCategory): SyntheticGame[] {
  return games.filter((g) => g.ageCategories.length === 0 || g.ageCategories.includes(category));
}

export async function generateSyntheticActivity(
  sql: postgres.TransactionSql,
  input: SyntheticActivityInput
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const gamesByGroup = new Map<GroupAgeCategory, SyntheticGame[]>();
  for (const cat of ["MIDDLE_3", "SENIOR_4", "PRESCHOOL_5"] as const) {
    gamesByGroup.set(cat, eligibleGames(input.games, cat));
  }
  const achievementByKey = new Map(input.achievements.map((a) => [a.key, a.id]));

  const notificationRows: { user_id: string; type: string; payload: unknown; created_at: string }[] = [];
  const auditRows: { actor_id: string; action: string; entity_type: string; entity_id: string; created_at: string }[] =
    [];

  // ── Per-child: game sessions, XP/level, ecolab, greenhouse ─────────
  for (const child of input.children) {
    const rng = mulberry32(hashStringToSeed(child.sourceImportKey));
    const engagement = 0.35 + rng() * 0.5; // weekday participation, 0.35–0.85
    const weekendEngagement = 0.1 + rng() * 0.25;
    const games = gamesByGroup.get(child.ageCategory) ?? [];

    const sessionRows: Record<string, unknown>[] = [];
    const recognitionRows: Record<string, unknown>[] = [];
    let totalXp = 0;
    let lastActiveIso: string | null = null;
    const bestRatioByGame = new Map<string, number>();

    // 0–2 greenhouse entries per child, planted at a random point in the window.
    const greenhouseEntryIds: string[] = [];
    const entryCount = rng() < 0.6 ? 1 : rng() < 0.5 ? 0 : 2;
    for (let i = 0; i < entryCount; i++) {
      const plantedDaysAgo = input.days - Math.floor(rng() * (input.days - 5));
      const plantedAt = daysAgoToDate(today, plantedDaysAgo, rng);
      const speciesPlant = input.species.filter((s) => s.kind === "PLANT");
      const species = speciesPlant.length > 0 ? pick(rng, speciesPlant) : null;
      const [entry] = await sql<{ id: string }[]>`
        insert into greenhouse_entries (child_id, species_id, nickname, planted_at, water_schedule)
        values (${child.id}, ${species?.id ?? null}, ${pick(rng, PLANT_NICKNAMES)}, ${plantedAt.toISOString().slice(0, 10)}, 'every_2_days')
        returning id
      `;
      greenhouseEntryIds.push(entry.id);
    }

    for (let d = input.days - 1; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      if (rng() > (isWeekend ? weekendEngagement : engagement)) continue;

      const activityCount = 1 + Math.floor(rng() * 3);
      for (let a = 0; a < activityCount; a++) {
        const startedAt = daysAgoToDate(today, d, rng);
        const roll = rng();

        if (roll < 0.55 && games.length > 0) {
          const game = pick(rng, games);
          const totalCount = 4 + Math.floor(rng() * 4);
          const correctCount = Math.max(1, Math.round(totalCount * (0.45 + rng() * 0.55)));
          const ratio = correctCount / totalCount;
          const score = Math.round(ratio * 100);
          const xpEarned = Math.max(1, Math.round(game.xpReward * ratio));
          totalXp += xpEarned;
          const endedAt = new Date(startedAt.getTime() + (120 + Math.floor(rng() * 240)) * 1000);
          sessionRows.push({
            child_id: child.id,
            game_id: game.id,
            started_at: startedAt.toISOString(),
            ended_at: endedAt.toISOString(),
            score,
            correct_count: correctCount,
            total_count: totalCount,
            xp_earned: xpEarned,
          });
          bestRatioByGame.set(game.key, Math.max(bestRatioByGame.get(game.key) ?? 0, ratio));
        } else if (roll < 0.78 && input.species.length > 0) {
          const species = pick(rng, input.species);
          recognitionRows.push({
            child_id: child.id,
            species_id: species.id,
            kind: species.kind,
            image_url: "/uploads/placeholder-recognition.jpg",
            confidence: (0.7 + rng() * 0.29).toFixed(3),
            ai_provider: "mock",
            ai_is_mock: true,
            ai_summary: sql.json({ label: "Табиғат объектісі" }),
          });
        } else if (greenhouseEntryIds.length > 0) {
          const entryId = pick(rng, greenhouseEntryIds);
          const heightCm = (2 + (input.days - d) * (0.15 + rng() * 0.35)).toFixed(2);
          await sql`
            insert into growth_logs (entry_id, logged_at, height_cm)
            values (${entryId}, ${date.toISOString().slice(0, 10)}, ${heightCm})
          `;
        }
        lastActiveIso = startedAt.toISOString();
      }
    }

    if (sessionRows.length > 0) {
      await sql`insert into game_sessions ${sql(sessionRows)}`;
    }
    if (recognitionRows.length > 0) {
      await sql`insert into recognitions ${sql(recognitionRows)}`;
    }

    // Achievements: award a game's own badge once a child's best ratio for
    // it clears a "good performance" bar, same spirit as the real
    // awardBadgeIfNotEarned runtime path (src/db/repo/achievements.ts),
    // applied here in bulk since this is a batch seed, not a live award.
    for (const [gameKey, ratio] of bestRatioByGame) {
      if (ratio < 0.75) continue;
      const game = input.games.find((g) => g.key === gameKey);
      if (!game?.badgeKey) continue;
      const achievementId = achievementByKey.get(game.badgeKey);
      if (!achievementId) continue;
      await sql`
        insert into child_achievements (child_id, achievement_id)
        values (${child.id}, ${achievementId})
        on conflict (child_id, achievement_id) do nothing
      `;
      notificationRows.push({
        user_id: child.id,
        type: "achievement",
        payload: { achievementKey: game.badgeKey },
        created_at: lastActiveIso ?? today.toISOString(),
      });
    }
    if (sessionRows.length > 0) {
      const firstStepsId = achievementByKey.get("first_steps");
      if (firstStepsId) {
        await sql`
          insert into child_achievements (child_id, achievement_id)
          values (${child.id}, ${firstStepsId})
          on conflict (child_id, achievement_id) do nothing
        `;
      }
    }

    // A child who's actually played earns a certificate — mirrors
    // scripts/seed.ts's demo certificate so the passport page's
    // download-a-PDF flow has something real to exercise for every
    // active child, not just the first-ever seeded one.
    if (sessionRows.length >= 3) {
      await sql`
        insert into certificates (school_id, child_id, title, reason, issued_at)
        values (
          ${input.schoolId}, ${child.id},
          '{"kk":"Табиғат досы сертификаты","ru":"Сертификат друга природы","en":"Friend of Nature Certificate"}',
          'Экологиялық ойындарда белсенді қатысқаны үшін',
          ${(lastActiveIso ?? today.toISOString())}
        )
      `;
    }

    const level = levelForXp(totalXp);
    await sql`
      update users set xp = ${totalXp}, level = ${level}, last_login_at = ${lastActiveIso}
      where id = ${child.id}
    `;

    if (rng() < 0.3 && lastActiveIso) {
      const [thread] = await sql<{ id: string }[]>`
        insert into chat_threads (user_id, kind) values (${child.id}, 'nature_chat') returning id
      `;
      const question = pick(rng, CHAT_OPENERS);
      const reply = pick(rng, CHAT_REPLIES);
      await sql`
        insert into chat_messages (thread_id, sender, content) values
          (${thread.id}, 'user', ${question}),
          (${thread.id}, 'assistant', ${reply})
      `;
    }
  }

  // ── Per group: one research project + observations from a subset of its children ──
  const childrenByGroup = new Map<string, SyntheticChild[]>();
  for (const child of input.children) {
    if (!childrenByGroup.has(child.groupId)) childrenByGroup.set(child.groupId, []);
    childrenByGroup.get(child.groupId)!.push(child);
  }
  const teacherByGroup = new Map(input.teachers.map((t) => [t.groupId, t]));

  for (const [groupId, groupChildren] of childrenByGroup) {
    const teacher = teacherByGroup.get(groupId);
    if (!teacher || groupChildren.length === 0) continue;
    const rng = mulberry32(hashStringToSeed(`research:${groupId}`));
    const startedDaysAgo = input.days - 5 - Math.floor(rng() * 10);
    const startedAt = daysAgoToDate(today, Math.max(startedDaysAgo, 1), rng);
    const [project] = await sql<{ id: string }[]>`
      insert into research_projects (group_id, created_by, title, question, hypothesis, measurement_unit, started_at)
      values (
        ${groupId}, ${teacher.id}, 'Өсімдіктің өсуін бақылау',
        'Өсімдік қанша тез өседі?', 'Күн сайын суғарылған өсімдік тезірек өседі деп ойлаймыз.',
        'cm', ${startedAt.toISOString()}
      )
      returning id
    `;
    const participants = groupChildren.filter(() => rng() < 0.4);
    for (const child of participants) {
      const obsCount = 2 + Math.floor(rng() * 4);
      for (let i = 0; i < obsCount; i++) {
        const daysAgo = Math.floor(rng() * input.days);
        const date = daysAgoToDate(today, daysAgo, rng);
        await sql`
          insert into research_observations (project_id, child_id, logged_at, measurement, note)
          values (${project.id}, ${child.id}, ${date.toISOString().slice(0, 10)}, ${(3 + i * 1.5 + rng() * 2).toFixed(2)}, null)
        `;
      }
    }
    auditRows.push({
      actor_id: teacher.id,
      action: "create",
      entity_type: "research_projects",
      entity_id: project.id,
      created_at: startedAt.toISOString(),
    });
  }

  // ── Per teacher: 2–4 lessons + assignment to their own group ───────
  for (const teacher of input.teachers) {
    const rng = mulberry32(hashStringToSeed(`lessons:${teacher.id}`));
    const lessonCount = 2 + Math.floor(rng() * 3);
    const topics = [
      "Су циклы", "Орман жануарлары", "Қоқысты сұрыптау", "Гүлдер әлемі",
      "Аспан және ауа райы", "Жануарлар үйлері", "Дала мен орман",
    ];
    for (let i = 0; i < lessonCount; i++) {
      const daysAgo = Math.floor(rng() * input.days);
      const createdAt = daysAgoToDate(today, daysAgo, rng);
      const [lesson] = await sql<{ id: string }[]>`
        insert into lessons (school_id, author_id, topic, status, age_categories, created_at)
        values (
          ${input.schoolId}, ${teacher.id}, ${pick(rng, topics)}, 'published',
          ${[teacher.ageCategory]}::group_age_category[], ${createdAt.toISOString()}
        )
        returning id
      `;
      await sql`
        insert into lesson_artifacts (lesson_id, type, content, ai_provider, ai_is_mock) values
          (${lesson.id}, 'LESSON_PLAN', ${sql.json({ objective: "Табиғатты танып білу", plan: ["Кіріспе әңгіме", "Практикалық тапсырма", "Қорытынды"] })}, 'mock', true),
          (${lesson.id}, 'QUIZ', ${sql.json({ questions: [] })}, 'mock', true),
          (${lesson.id}, 'HOMEWORK', ${sql.json({ tip: "Үйде отбасымен талқылаңыз" })}, 'mock', true)
      `;
      await sql`insert into lesson_assignments (lesson_id, group_id, assigned_at) values (${lesson.id}, ${teacher.groupId}, ${createdAt.toISOString()})`;
      auditRows.push({
        actor_id: teacher.id,
        action: "publish",
        entity_type: "lessons",
        entity_id: lesson.id,
        created_at: createdAt.toISOString(),
      });
    }
  }

  if (notificationRows.length > 0) {
    const rows = notificationRows.map((r) => ({
      ...r,
      payload: sql.json(r.payload as unknown as postgres.JSONValue),
    }));
    await sql`insert into notifications ${sql(rows)}`;
  }
  if (auditRows.length > 0) {
    const rows = auditRows.map((r) => ({ school_id: input.schoolId, ...r }));
    await sql`insert into audit_logs ${sql(rows)}`;
  }
}
