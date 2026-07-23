/**
 * One-time production data cutover: replaces every demo person/group
 * with the real roster from private-data/1.xlsx, generates 60 days of
 * synthetic operational history, and replaces demo/smoke news with 30
 * real articles. Never runs automatically (not wired into any build/
 * deploy step) — always an explicit, controlled command.
 *
 * Usage:
 *   npx tsx scripts/import-private-data.ts --dry-run   (default, no writes)
 *   npx tsx scripts/import-private-data.ts --apply     (transactional write)
 *
 * Connects with DATABASE_URL (admin), same as scripts/migrate.ts and
 * scripts/seed.ts — never APP_DATABASE_URL (see src/db/client.ts).
 *
 * Idempotent: every group/teacher/assistant/parent/child is upserted by
 * a deterministic `source_import_key` derived from the Excel row(s)
 * that produced it (see scripts/import/parse-excel.ts). Re-running
 * --apply against the same Excel updates existing rows in place and
 * inserts nothing new — login credentials, once generated on first
 * insert, are never regenerated or changed by a later re-run.
 */
import { config } from "dotenv";
import path from "node:path";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import {
  generateChildLoginCode,
  generateImportEmail,
  generateReviewLoginCode,
  generateStrongPin,
  generateTempPassword,
  GROUP_DEFINITIONS,
  parseChildrenRows,
  validateExpectedGroups,
  type ParsedWorkbook,
} from "./import/parse-excel";
import { readPrivateDataWorkbook } from "./import/read-workbook";
import { generateSyntheticActivity } from "./seed-data/synthetic-activity";
import { NEWS_ARTICLES } from "./seed-data/news-articles";

config({ path: ".env.local" });
config();

// Mirrors src/db/repo/groups.ts's private syncTeacherGroups exactly —
// can't import that file directly, it starts with `server-only`, which
// unconditionally throws outside the Next.js build system.
async function syncTeacherGroups(tx: postgres.TransactionSql, groupId: string, teacherIds: (string | null)[]) {
  await tx`delete from teacher_groups where group_id = ${groupId}`;
  const uniqueIds = [...new Set(teacherIds.filter((id): id is string => !!id))];
  for (const teacherId of uniqueIds) {
    await tx`
      insert into teacher_groups (teacher_id, group_id) values (${teacherId}, ${groupId})
      on conflict do nothing
    `;
  }
}

const TARGET_SCHOOL_NAME = '№37 «Жұлдыз-ай» бөбекжайы';
const DEMO_GROUP_CODES = ["KUN-01", "ORTA-01", "ERESEK-01", "MAD-01"];
const OLD_NEWS_AUTHOR_FALLBACK = "Әкімшілік";
const ACADEMIC_YEAR = "2025-2026";
const SYNTHETIC_DAYS = 60;
const SALT_ROUNDS = 10;

const EXPECTED = {
  sheetCount: 3,
  totalRows: 232,
  uniqueChildren: 230,
  uniqueParents: 219,
  groupCount: 11,
  teacherCount: 11,
  assistantCount: 10,
  needsReviewCount: 2,
  assignedChildCount: 228,
};

type CredentialRow = {
  role: string;
  displayName: string;
  loginIdentifier: string;
  plainSecret: string;
  groupCode: string;
};

function printChecklist(parsed: ParsedWorkbook, sheetCount: number) {
  console.log("\n=== Excel тексеру нәтижесі ===");
  console.log(`Парақ саны: ${sheetCount} (күтілген: ${EXPECTED.sheetCount})`);
  console.log(`Дерек жолдары: ${parsed.stats.totalRows} (күтілген: ${EXPECTED.totalRows})`);
  console.log(`Бірегей бала: ${parsed.stats.uniqueChildren} (күтілген: ${EXPECTED.uniqueChildren})`);
  console.log(`Бірегей ата-ана: ${parsed.stats.uniqueParents} (күтілген: ${EXPECTED.uniqueParents})`);
  console.log(`Топ саны: ${parsed.stats.groupCount} (күтілген: ${EXPECTED.groupCount})`);
  console.log(`Негізгі тәрбиеші: ${parsed.stats.teacherCount} (күтілген: ${EXPECTED.teacherCount})`);
  console.log(`Педагог-ассистент: ${parsed.stats.assistantCount} (күтілген: ${EXPECTED.assistantCount})`);
  console.log(`Needs-review бала: ${parsed.stats.needsReviewCount} (күтілген: ${EXPECTED.needsReviewCount})`);
  console.log(`Топқа бекітілген бала: ${parsed.stats.assignedChildCount} (күтілген: ${EXPECTED.assignedChildCount})`);
  const erketai = parsed.groups.find((g) => g.code === "ERKETAI-01");
  console.log(`«Еркетай» ассистенті: ${erketai?.assistantKey ?? "—"} (күтілген: жоқ)`);
}

function assertMatchesBaseline(parsed: ParsedWorkbook, sheetCount: number) {
  const diffs: string[] = [];
  if (sheetCount !== EXPECTED.sheetCount) diffs.push(`sheetCount: ${sheetCount} ≠ ${EXPECTED.sheetCount}`);
  if (parsed.stats.totalRows !== EXPECTED.totalRows) diffs.push(`totalRows: ${parsed.stats.totalRows} ≠ ${EXPECTED.totalRows}`);
  if (parsed.stats.uniqueChildren !== EXPECTED.uniqueChildren)
    diffs.push(`uniqueChildren: ${parsed.stats.uniqueChildren} ≠ ${EXPECTED.uniqueChildren}`);
  if (parsed.stats.uniqueParents !== EXPECTED.uniqueParents)
    diffs.push(`uniqueParents: ${parsed.stats.uniqueParents} ≠ ${EXPECTED.uniqueParents}`);
  if (parsed.stats.groupCount !== EXPECTED.groupCount) diffs.push(`groupCount: ${parsed.stats.groupCount} ≠ ${EXPECTED.groupCount}`);
  if (parsed.stats.teacherCount !== EXPECTED.teacherCount)
    diffs.push(`teacherCount: ${parsed.stats.teacherCount} ≠ ${EXPECTED.teacherCount}`);
  if (parsed.stats.assistantCount !== EXPECTED.assistantCount)
    diffs.push(`assistantCount: ${parsed.stats.assistantCount} ≠ ${EXPECTED.assistantCount}`);
  if (parsed.stats.needsReviewCount !== EXPECTED.needsReviewCount)
    diffs.push(`needsReviewCount: ${parsed.stats.needsReviewCount} ≠ ${EXPECTED.needsReviewCount}`);
  if (parsed.stats.assignedChildCount !== EXPECTED.assignedChildCount)
    diffs.push(`assignedChildCount: ${parsed.stats.assignedChildCount} ≠ ${EXPECTED.assignedChildCount}`);

  if (diffs.length > 0) {
    console.error("\n✗ Excel деректері бұрын расталған нәтижеден өзгеше — импорт тоқтатылды:");
    diffs.forEach((d) => console.error(`  - ${d}`));
    process.exit(1);
  }
  console.log("\n✓ Барлық сан бұрын расталған нәтижемен дәл сәйкес келеді.");
}

async function ensureSchool(tx: postgres.TransactionSql): Promise<string> {
  const existing = await tx<{ id: string }[]>`select id from schools where name = ${TARGET_SCHOOL_NAME} limit 1`;
  if (existing[0]) return existing[0].id;

  const any = await tx<{ id: string }[]>`select id from schools order by created_at asc limit 1`;
  if (any[0]) {
    await tx`update schools set name = ${TARGET_SCHOOL_NAME} where id = ${any[0].id}`;
    return any[0].id;
  }
  const [created] = await tx<{ id: string }[]>`
    insert into schools (name, default_locale, plan) values (${TARGET_SCHOOL_NAME}, 'kk', 'growth') returning id
  `;
  return created.id;
}

// Deletes every existing CHILD/TEACHER/PARENT row that was NOT produced
// by a previous run of this import (source_import_key is null) — item
// 1's rule is absolute: those three roles may ONLY come from the Excel
// import, so any pre-existing demo/seed/e2e-fixture row (e.g.
// e2e-child-01, e2e-teacher@ecostart.local, is_demo=true seed rows) is
// removed regardless of its is_demo flag. Rows already tagged with a
// source_import_key from an earlier --apply are deliberately spared
// here — they are updated in place by the upsert*() functions below,
// which is what makes re-running --apply idempotent and keeps
// previously-issued child PINs/parent-teacher passwords valid instead
// of silently regenerating (and invalidating) them on every re-run.
// SUPER_ADMIN/SCHOOL_ADMIN are never touched (excluded by role filter).
async function cleanupDemoData(tx: postgres.TransactionSql) {
  const children = await tx`delete from users where role = 'CHILD' and source_import_key is null`;
  const teachers = await tx`delete from users where role = 'TEACHER' and source_import_key is null`;
  const parents = await tx`delete from users where role = 'PARENT' and source_import_key is null`;
  const groups = await tx`delete from groups where code = any(${DEMO_GROUP_CODES})`;
  await tx`update users set is_demo = false where role in ('SUPER_ADMIN', 'SCHOOL_ADMIN')`;
  return {
    children: children.count,
    teachers: teachers.count,
    parents: parents.count,
    groups: groups.count,
  };
}

async function upsertStaffOrParent(
  tx: postgres.TransactionSql,
  schoolId: string,
  role: "TEACHER" | "PARENT",
  displayName: string,
  sourceImportKey: string,
  emailSeq: number,
  credentials: CredentialRow[]
): Promise<string> {
  const existing = await tx<{ id: string }[]>`select id from users where source_import_key = ${sourceImportKey}`;
  if (existing[0]) {
    await tx`update users set display_name = ${displayName}, is_demo = false where id = ${existing[0].id}`;
    return existing[0].id;
  }
  const email = generateImportEmail(displayName, emailSeq);
  const plainPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  const [created] = await tx<{ id: string }[]>`
    insert into users (school_id, role, email, password_hash, display_name, source_import_key, is_demo)
    values (${schoolId}, ${role}, ${email}, ${passwordHash}, ${displayName}, ${sourceImportKey}, false)
    returning id
  `;
  credentials.push({ role, displayName, loginIdentifier: email, plainSecret: plainPassword, groupCode: "" });
  return created.id;
}

async function upsertGroup(
  tx: postgres.TransactionSql,
  schoolId: string,
  code: string,
  excelName: string,
  ageCategory: string,
  educatorId: string,
  assistantId: string | null
): Promise<string> {
  const importKey = `group:${code}`;
  const existing = await tx<{ id: string }[]>`select id from groups where source_import_key = ${importKey}`;
  if (existing[0]) {
    await tx`
      update groups set
        name = ${excelName}, age_category = ${ageCategory}::group_age_category,
        educator_id = ${educatorId}, pedagogical_assistant_id = ${assistantId},
        academic_year = ${ACADEMIC_YEAR}, is_active = true, archived_at = null, updated_at = now()
      where id = ${existing[0].id}
    `;
    return existing[0].id;
  }
  const [created] = await tx<{ id: string }[]>`
    insert into groups (
      school_id, name, code, age_category, educator_id, pedagogical_assistant_id,
      academic_year, is_active, source_import_key
    ) values (
      ${schoolId}, ${excelName}, ${code}, ${ageCategory}::group_age_category,
      ${educatorId}, ${assistantId}, ${ACADEMIC_YEAR}, true, ${importKey}
    )
    returning id
  `;
  return created.id;
}

async function upsertChild(
  tx: postgres.TransactionSql,
  schoolId: string,
  displayName: string,
  sourceImportKey: string,
  loginCode: string,
  groupId: string | null,
  needsReview: boolean,
  reviewNote: Record<string, unknown> | null,
  groupCodeForCsv: string,
  credentials: CredentialRow[]
): Promise<string> {
  const existing = await tx<{ id: string }[]>`select id from users where source_import_key = ${sourceImportKey}`;
  if (existing[0]) {
    await tx`
      update users set
        display_name = ${displayName}, group_id = ${groupId}, needs_review = ${needsReview},
        review_note = ${reviewNote ? tx.json(reviewNote as never) : null}, is_demo = false
      where id = ${existing[0].id}
    `;
    return existing[0].id;
  }
  const plainPin = generateStrongPin();
  const pinHash = await bcrypt.hash(plainPin, SALT_ROUNDS);
  const [created] = await tx<{ id: string }[]>`
    insert into users (
      school_id, role, login_code, pin_hash, display_name, group_id,
      needs_review, review_note, source_import_key, is_demo
    ) values (
      ${schoolId}, 'CHILD', ${loginCode}, ${pinHash}, ${displayName}, ${groupId},
      ${needsReview}, ${reviewNote ? tx.json(reviewNote as never) : null}, ${sourceImportKey}, false
    )
    returning id
  `;
  credentials.push({
    role: "CHILD",
    displayName,
    loginIdentifier: loginCode,
    plainSecret: plainPin,
    groupCode: groupCodeForCsv,
  });
  return created.id;
}

// generateSyntheticActivity (scripts/seed-data/synthetic-activity.ts) is
// deterministic — same PRNG seed per person/group — but every write it
// does is a bare INSERT with no dedup key, so calling it twice would
// double every row (confirmed: a second --apply tripled research_projects
// 11→33 before this function existed). Since real families haven't used
// the platform yet, every row in these tables for a real imported
// child/teacher/group IS synthetic, so a full delete-then-regenerate here
// nets to the exact same deterministic content on every re-run — true
// idempotency, without needing a dedup key on every table.
// audit_logs is scoped to the specific (action, entity_type) pairs the
// generator writes so this never touches a genuine admin/e2e audit
// entry for the same actor.
async function cleanupSyntheticActivity(
  tx: postgres.TransactionSql,
  childIds: string[],
  teacherIds: string[],
  groupIds: string[]
) {
  if (childIds.length > 0) {
    await tx`delete from growth_logs where entry_id in (select id from greenhouse_entries where child_id = any(${childIds}))`;
    await tx`delete from greenhouse_entries where child_id = any(${childIds})`;
    await tx`delete from game_sessions where child_id = any(${childIds})`;
    await tx`delete from recognitions where child_id = any(${childIds})`;
    await tx`delete from chat_messages where thread_id in (select id from chat_threads where user_id = any(${childIds}))`;
    await tx`delete from chat_threads where user_id = any(${childIds})`;
    await tx`delete from research_observations where child_id = any(${childIds})`;
    await tx`delete from child_achievements where child_id = any(${childIds})`;
    await tx`delete from certificates where child_id = any(${childIds})`;
    await tx`delete from notifications where user_id = any(${childIds}) and type = 'achievement'`;
  }
  if (groupIds.length > 0) {
    await tx`delete from research_observations where project_id in (select id from research_projects where group_id = any(${groupIds}))`;
    await tx`delete from research_projects where group_id = any(${groupIds})`;
    await tx`delete from lesson_assignments where group_id = any(${groupIds})`;
  }
  if (teacherIds.length > 0) {
    await tx`delete from lesson_artifacts where lesson_id in (select id from lessons where author_id = any(${teacherIds}))`;
    await tx`delete from lesson_assignments where lesson_id in (select id from lessons where author_id = any(${teacherIds}))`;
    await tx`delete from lessons where author_id = any(${teacherIds})`;
    await tx`delete from audit_logs where actor_id = any(${teacherIds}) and entity_type in ('research_projects', 'lessons')`;
  }
}

async function importNews(tx: postgres.TransactionSql, teacherNamesInSpecOrder: string[]) {
  await tx`delete from news_items`;
  const today = new Date();
  for (const article of NEWS_ARTICLES) {
    const displayDate = new Date(today);
    displayDate.setDate(displayDate.getDate() - article.daysAgo);
    const author = teacherNamesInSpecOrder[article.authorIndex] ?? OLD_NEWS_AUTHOR_FALLBACK;
    await tx`
      insert into news_items (
        status, enabled, featured_home, display_order, slug, title, excerpt, body,
        category, author, display_date, view_count, published_at
      ) values (
        'published', true, ${article.featured}, ${article.daysAgo}, ${article.slug},
        ${article.title}, ${article.excerpt}, ${article.body}, ${article.category}, ${author},
        ${displayDate.toISOString()}, ${article.viewCount}, ${displayDate.toISOString()}
      )
    `;
  }
}

async function validateImport(tx: postgres.TransactionSql, parsed: ParsedWorkbook, schoolId: string) {
  const groupCodes = parsed.groups.map((g) => g.code);
  const teacherKeys = [...parsed.teachers.keys()];
  const assistantKeys = [...parsed.assistants.keys()];

  const [row] = await tx<
    {
      groups: number;
      teachers: number;
      assistants: number;
      parents: number;
      children: number;
      assigned: number;
      needsReview: number;
    }[]
  >`
    select
      (select count(*)::int from groups where school_id = ${schoolId} and code = any(${groupCodes})) as groups,
      (select count(*)::int from users where school_id = ${schoolId} and role = 'TEACHER' and source_import_key = any(${teacherKeys})) as teachers,
      (select count(*)::int from users where school_id = ${schoolId} and role = 'TEACHER' and source_import_key = any(${assistantKeys})) as assistants,
      (select count(*)::int from users where school_id = ${schoolId} and role = 'PARENT') as parents,
      (select count(*)::int from users where school_id = ${schoolId} and role = 'CHILD') as children,
      (select count(*)::int from users where school_id = ${schoolId} and role = 'CHILD' and group_id is not null) as assigned,
      (select count(*)::int from users where school_id = ${schoolId} and role = 'CHILD' and needs_review = true) as "needsReview"
  `;

  const diffs: string[] = [];
  if (row.groups !== parsed.stats.groupCount) diffs.push(`groups: ${row.groups} ≠ ${parsed.stats.groupCount}`);
  if (row.teachers !== parsed.stats.teacherCount) diffs.push(`teachers: ${row.teachers} ≠ ${parsed.stats.teacherCount}`);
  if (row.assistants !== parsed.stats.assistantCount)
    diffs.push(`assistants: ${row.assistants} ≠ ${parsed.stats.assistantCount}`);
  if (row.parents !== parsed.stats.uniqueParents) diffs.push(`parents: ${row.parents} ≠ ${parsed.stats.uniqueParents}`);
  if (row.children !== parsed.stats.uniqueChildren) diffs.push(`children: ${row.children} ≠ ${parsed.stats.uniqueChildren}`);
  if (row.assigned !== parsed.stats.assignedChildCount)
    diffs.push(`assigned: ${row.assigned} ≠ ${parsed.stats.assignedChildCount}`);
  if (row.needsReview !== parsed.stats.needsReviewCount)
    diffs.push(`needsReview: ${row.needsReview} ≠ ${parsed.stats.needsReviewCount}`);

  if (diffs.length > 0) {
    throw new Error(`Импорттан кейінгі тексеру сәтсіз аяқталды:\n${diffs.join("\n")}`);
  }
}

function writeCredentialsCsv(filePath: string, rows: CredentialRow[]) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "role,displayName,loginIdentifier,plainSecret,groupCode";
  const lines = rows.map((r) =>
    [r.role, r.displayName, r.loginIdentifier, r.plainSecret, r.groupCode].map(escape).join(",")
  );
  writeFileSync(filePath, [header, ...lines].join("\n") + "\n", "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply || args.includes("--dry-run");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }

  const excelPath = path.join(process.cwd(), "private-data", "1.xlsx");
  console.log(`→ Excel оқылуда: ${excelPath}`);
  const { sheetNames, rows } = readPrivateDataWorkbook(excelPath);
  const parsed = parseChildrenRows(rows);
  validateExpectedGroups(parsed);
  printChecklist(parsed, sheetNames.length);
  assertMatchesBaseline(parsed, sheetNames.length);

  if (dryRun) {
    console.log("\n=== DRY-RUN — ешқандай жазу орындалмайды ===");
    console.log(`Топтар: ${GROUP_DEFINITIONS.map((g) => g.code).join(", ")}`);
    console.log(`Нысаналы ұйым: "${TARGET_SCHOOL_NAME}"`);
    console.log("--apply жалауымен нақты импортты бастаңыз.");
    return;
  }

  console.log("\n=== APPLY — транзакция ішінде нақты импорт басталады ===");
  const sql = postgres(connectionString, { max: 1 });
  const credentials: CredentialRow[] = [];

  try {
    await sql.begin(async (tx) => {
      const schoolId = await ensureSchool(tx);
      console.log(`✓ Ұйым дайын: "${TARGET_SCHOOL_NAME}" (${schoolId})`);

      const cleanup = await cleanupDemoData(tx);
      console.log(
        `✓ Demo деректер тазаланды: балалар=${cleanup.children}, тәрбиешілер=${cleanup.teachers}, ата-аналар=${cleanup.parents}, топтар=${cleanup.groups}`
      );

      // Teachers/assistants — a shared users pool, one row per distinct
      // name (parseChildrenRows already guarantees zero name overlap
      // between the two sets).
      const teacherIdByKey = new Map<string, string>();
      let emailSeq = 1;
      for (const [key, name] of parsed.teachers) {
        teacherIdByKey.set(key, await upsertStaffOrParent(tx, schoolId, "TEACHER", name, key, emailSeq++, credentials));
      }
      for (const [key, name] of parsed.assistants) {
        teacherIdByKey.set(key, await upsertStaffOrParent(tx, schoolId, "TEACHER", name, key, emailSeq++, credentials));
      }
      console.log(`✓ Тәрбиешілер мен ассистенттер: ${teacherIdByKey.size}`);

      const groupIdByCode = new Map<string, string>();
      const teacherNamesInSpecOrder: string[] = [];
      for (const def of GROUP_DEFINITIONS) {
        const parsedGroup = parsed.groups.find((g) => g.code === def.code)!;
        const educatorId = teacherIdByKey.get(parsedGroup.mainTeacherKey)!;
        const assistantId = parsedGroup.assistantKey ? (teacherIdByKey.get(parsedGroup.assistantKey) ?? null) : null;
        const groupId = await upsertGroup(tx, schoolId, def.code, def.excelName, def.ageCategory, educatorId, assistantId);
        groupIdByCode.set(def.code, groupId);
        await syncTeacherGroups(tx, groupId, [educatorId, assistantId]);
        teacherNamesInSpecOrder.push(parsed.teachers.get(parsedGroup.mainTeacherKey) ?? OLD_NEWS_AUTHOR_FALLBACK);
      }
      console.log(`✓ Топтар: ${groupIdByCode.size}`);

      let parentEmailSeq = 1;
      const parentIdByKey = new Map<string, string>();
      for (const [key, name] of parsed.parents) {
        parentIdByKey.set(key, await upsertStaffOrParent(tx, schoolId, "PARENT", name, key, parentEmailSeq++, credentials));
      }
      console.log(`✓ Ата-аналар: ${parentIdByKey.size}`);

      const childSeqByGroup = new Map<string, number>();
      let reviewSeq = 0;
      const childIdByKey = new Map<string, { id: string; groupId: string | null }>();
      const sortedChildren = [...parsed.children].sort((a, b) => a.name.localeCompare(b.name, "kk"));
      for (const child of sortedChildren) {
        let loginCode: string;
        let groupId: string | null = null;
        let reviewNote: Record<string, unknown> | null = null;
        if (child.needsReview) {
          reviewSeq++;
          loginCode = generateReviewLoginCode(reviewSeq);
          reviewNote = { candidateGroupCodes: child.candidateGroupCodes, reason: "excel_duplicate_row" };
        } else {
          groupId = groupIdByCode.get(child.groupCode!)!;
          const seq = (childSeqByGroup.get(child.groupCode!) ?? 0) + 1;
          childSeqByGroup.set(child.groupCode!, seq);
          loginCode = generateChildLoginCode(child.groupCode!, seq);
        }
        const childId = await upsertChild(
          tx,
          schoolId,
          child.name,
          child.importKey,
          loginCode,
          groupId,
          child.needsReview,
          reviewNote,
          child.groupCode ?? "",
          credentials
        );
        childIdByKey.set(child.importKey, { id: childId, groupId });

        const parentId = parentIdByKey.get(child.parentKey);
        if (parentId) {
          await tx`
            insert into parent_child_links (parent_id, child_id, relation, consent_at)
            values (${parentId}, ${childId}, 'parent', now())
            on conflict (parent_id, child_id) do nothing
          `;
        }
      }
      console.log(`✓ Балалар: ${childIdByKey.size} (needs-review: ${reviewSeq})`);

      for (const [code, groupId] of groupIdByCode) {
        const [{ count }] = await tx<{ count: number }[]>`
          select count(*)::int as count from users where group_id = ${groupId} and role = 'CHILD'
        `;
        await tx`update groups set child_count = ${count} where id = ${groupId}`;
        void code;
      }

      await importNews(tx, teacherNamesInSpecOrder);
      console.log(`✓ Жаңалықтар: ${NEWS_ARTICLES.length} мақала`);

      await cleanupSyntheticActivity(
        tx,
        [...childIdByKey.values()].map((v) => v.id),
        [...teacherIdByKey.values()],
        [...groupIdByCode.values()]
      );

      console.log("→ 60 күндік synthetic activity жасалуда (бұл біраз уақыт алуы мүмкін)...");
      const [speciesRows, achievementRows, gameRows, teacherRowsForActivity] = await Promise.all([
        tx<{ id: string; kind: "PLANT" | "ANIMAL" | "LEAF" | "OBJECT" }[]>`select id, kind from species`,
        tx<{ id: string; key: string }[]>`select id, key from achievements`,
        tx<{ id: string; key: string; xp_reward: number; badge_key: string | null; age_categories: string[] }[]>`
          select id, key, xp_reward, badge_key, age_categories from games
        `,
        tx<{ id: string; group_id: string }[]>`
          select distinct g.educator_id as id, g.id as group_id from groups g where g.educator_id is not null
        `,
      ]);

      const groupAgeByCode = new Map(GROUP_DEFINITIONS.map((d) => [d.code, d.ageCategory]));
      const syntheticChildren = [...childIdByKey.entries()]
        .filter(([, v]) => v.groupId !== null)
        .map(([key, v]) => {
          const child = sortedChildren.find((c) => c.importKey === key)!;
          return {
            id: v.id,
            groupId: v.groupId!,
            ageCategory: groupAgeByCode.get(child.groupCode!)!,
            sourceImportKey: key,
          };
        });
      const syntheticTeachers = teacherRowsForActivity.map((t) => {
        const code = [...groupIdByCode.entries()].find(([, gid]) => gid === t.group_id)?.[0];
        return { id: t.id, groupId: t.group_id, ageCategory: groupAgeByCode.get(code ?? "")! };
      });

      await generateSyntheticActivity(tx, {
        schoolId,
        days: SYNTHETIC_DAYS,
        children: syntheticChildren,
        teachers: syntheticTeachers,
        species: speciesRows,
        achievements: achievementRows,
        games: gameRows.map((g) => ({
          id: g.id,
          key: g.key,
          xpReward: g.xp_reward,
          badgeKey: g.badge_key,
          ageCategories: (g.age_categories ?? []) as never,
        })),
      });
      console.log("✓ Synthetic activity дайын.");

      await validateImport(tx, parsed, schoolId);
      console.log("✓ Пост-импорт тексеру сәтті өтті.");

      if (credentials.length > 0) {
        const csvPath = path.join(process.cwd(), "private-data", "import-credentials.csv");
        writeCredentialsCsv(csvPath, credentials);
        console.log(`✓ ${credentials.length} жаңа credential "${csvPath}" файлына жазылды (Git-ке кірмейді).`);
      } else {
        console.log("✓ Жаңа credential жасалмады (барлық адам бұрыннан бар — идемпотентті қайта жүру).");
      }
    });

    console.log("\n✓ Транзакция сәтті commit болды. Импорт аяқталды.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("\n✗ Импорт сәтсіз аяқталды, барлық өзгеріс rollback болды:", err instanceof Error ? err.message : err);
  process.exit(1);
});
