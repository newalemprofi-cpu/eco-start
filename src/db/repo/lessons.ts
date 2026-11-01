import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import { readJsonb } from "@/db/jsonb";
import type { LessonBundle } from "@/lib/ai/types";
import type { GroupAgeCategory } from "@/lib/group-age-categories";

// Lifecycle (lessons.status, check constraint since 0001_init.sql):
//   draft     — saved, visible to its author only
//   published — visible to children of every group in lesson_assignments
//   archived  — hidden from children, kept with its assignments so it
//               can be restored; nothing here ever deletes a lesson.
export type { LessonStatus } from "@/lib/domain/lesson-status";
import type { LessonStatus } from "@/lib/domain/lesson-status";

export class LessonNotFoundError extends Error {
  constructor() {
    super("Оқу-ойын әрекеті табылмады.");
  }
}

export class GroupNotOwnedError extends Error {
  constructor() {
    super("Бұл топ сізге бекітілмеген.");
  }
}

type Tx = Parameters<Parameters<typeof withTenantContext>[1]>[0];

/** A teacher may only publish to groups linked to them in teacher_groups
 * (kept in sync with groups.educator_id/assistant by groups.ts). */
async function assertTeacherOwnsGroup(sql: Tx, teacherId: string, groupId: string) {
  const [row] = await sql<{ ok: number }[]>`
    select 1 as ok from teacher_groups where teacher_id = ${teacherId} and group_id = ${groupId}
  `;
  if (!row) throw new GroupNotOwnedError();
}

async function assignToGroup(sql: Tx, lessonId: string, groupId: string): Promise<boolean> {
  // lesson_assignments has no unique (lesson_id, group_id) constraint,
  // so the duplicate check is explicit rather than `on conflict`.
  const inserted = await sql`
    insert into lesson_assignments (lesson_id, group_id)
    select ${lessonId}, ${groupId}
    where not exists (
      select 1 from lesson_assignments where lesson_id = ${lessonId} and group_id = ${groupId}
    )
  `;
  return inserted.count > 0;
}

export async function createLessonWithArtifacts(
  ctx: TenantContext,
  input: {
    topic: string;
    locale: "kk" | "ru" | "en";
    ageBand: string;
    bundle: LessonBundle;
    isMock: boolean;
    provider: string;
    status: "draft" | "published";
    /** Required when status is "published" — a published lesson with no
     * assignment is invisible to every child, which was the original
     * "Топқа жариялау" bug. */
    groupId?: string;
    /** Empty = "барлық санат" (shown regardless of group), same
     * convention as games.age_categories. */
    ageCategories?: GroupAgeCategory[];
  }
): Promise<{ id: string }> {
  if (input.status === "published" && !input.groupId) throw new GroupNotOwnedError();

  return withTenantContext(ctx, async (sql) => {
    if (input.groupId) await assertTeacherOwnsGroup(sql, ctx.userId, input.groupId);

    const [lesson] = await sql<{ id: string }[]>`
      insert into lessons (school_id, author_id, topic, locale, age_band, status, age_categories)
      values (
        ${ctx.schoolId}, ${ctx.userId}, ${input.topic}, ${input.locale}, ${input.ageBand}, ${input.status},
        ${input.ageCategories ?? []}::group_age_category[]
      )
      returning id
    `;

    const plan = {
      objective: input.bundle.objective,
      plan: input.bundle.plan,
      durationMinutes: input.bundle.durationMinutes ?? null,
    };
    await sql`
      insert into lesson_artifacts (lesson_id, type, content, ai_provider, ai_is_mock)
      values
        (${lesson.id}, 'LESSON_PLAN', ${sql.json(plan)}, ${input.provider}, ${input.isMock}),
        (${lesson.id}, 'QUIZ', ${sql.json({ questions: input.bundle.quiz })}, ${input.provider}, ${input.isMock}),
        (${lesson.id}, 'HOMEWORK', ${sql.json({ tip: input.bundle.homeworkTip })}, ${input.provider}, ${input.isMock})
    `;

    if (input.status === "published" && input.groupId) {
      await assignToGroup(sql, lesson.id, input.groupId);
    }

    return lesson;
  });
}

export type LessonGroupAssignment = {
  groupId: string;
  groupName: string;
  groupCode: string;
  assignedAt: string;
  /** Children currently in that group — i.e. who can open the lesson. */
  childCount: number;
};

export type LessonListItem = {
  id: string;
  topic: string;
  status: LessonStatus;
  createdAt: string;
  ageBand: string;
  ageCategories: GroupAgeCategory[];
  groups: LessonGroupAssignment[];
};

const GROUPS_JSON = (sql: Tx) => sql`
  coalesce((
    select json_agg(json_build_object(
      'groupId', g.id, 'groupName', g.name, 'groupCode', g.code, 'assignedAt', la.assigned_at,
      'childCount', (select count(*)::int from users c where c.group_id = g.id and c.role = 'CHILD' and c.archived_at is null)
    ) order by la.assigned_at)
    from lesson_assignments la join groups g on g.id = la.group_id
    where la.lesson_id = l.id
  ), '[]'::json)
`;

export async function listLessons(ctx: TenantContext): Promise<LessonListItem[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<LessonListItem[]>`
      select l.id, l.topic, l.status, l.created_at as "createdAt", l.age_band as "ageBand",
             l.age_categories as "ageCategories", ${GROUPS_JSON(sql)} as groups
      from lessons l
      where l.author_id = ${ctx.userId}
      order by l.created_at desc
    `
  );
}

export type LessonContent = {
  objective: string;
  plan: string[];
  durationMinutes: number | null;
  quiz: { question: string; options: string[]; correctIndex: number }[];
  homeworkTip: string | null;
  isMock: boolean;
};

export type LessonDetail = LessonListItem & { content: LessonContent };

/** Artifacts are stored one row per type (0001_init.sql) — this folds
 * the three the generator writes back into one view model. Seeded
 * lessons have no HOMEWORK row, hence every field's fallback. */
function foldArtifacts(rows: { type: string; content: unknown; isMock: boolean }[]): LessonContent {
  // readJsonb: rows saved before the sql.json fix are double-encoded strings.
  const byType = new Map(rows.map((r) => [r.type, readJsonb<Record<string, unknown>>(r.content) ?? {}]));
  const plan = byType.get("LESSON_PLAN") ?? {};
  const quiz = byType.get("QUIZ") ?? {};
  const homework = byType.get("HOMEWORK") ?? {};
  return {
    objective: typeof plan.objective === "string" ? plan.objective : "",
    plan: Array.isArray(plan.plan) ? plan.plan.filter((s): s is string => typeof s === "string") : [],
    durationMinutes: typeof plan.durationMinutes === "number" ? plan.durationMinutes : null,
    quiz: Array.isArray(quiz.questions) ? (quiz.questions as LessonContent["quiz"]) : [],
    homeworkTip: typeof homework.tip === "string" ? homework.tip : null,
    isMock: rows.some((r) => r.isMock),
  };
}

async function loadArtifacts(sql: Tx, lessonId: string) {
  return sql<{ type: string; content: unknown; isMock: boolean }[]>`
    select type, content, ai_is_mock as "isMock" from lesson_artifacts where lesson_id = ${lessonId}
  `;
}

/** Author-only: a teacher never opens another teacher's lesson here. */
export async function getLessonForTeacher(ctx: TenantContext, lessonId: string): Promise<LessonDetail | null> {
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<LessonListItem[]>`
      select l.id, l.topic, l.status, l.created_at as "createdAt", l.age_band as "ageBand",
             l.age_categories as "ageCategories", ${GROUPS_JSON(sql)} as groups
      from lessons l
      where l.id = ${lessonId} and l.author_id = ${ctx.userId}
    `;
    if (!rows[0]) return null;
    return { ...rows[0], content: foldArtifacts(await loadArtifacts(sql, lessonId)) };
  });
}

/** Publishes an existing lesson (draft, archived, or a legacy
 * "published" row that never got an assignment) to one of the
 * teacher's groups. Idempotent per group. */
export async function publishLessonToGroup(
  ctx: TenantContext,
  lessonId: string,
  groupId: string
): Promise<{ newlyAssigned: boolean }> {
  return withTenantContext(ctx, async (sql) => {
    const [lesson] = await sql<{ id: string }[]>`
      select id from lessons where id = ${lessonId} and author_id = ${ctx.userId}
    `;
    if (!lesson) throw new LessonNotFoundError();
    await assertTeacherOwnsGroup(sql, ctx.userId, groupId);
    const newlyAssigned = await assignToGroup(sql, lessonId, groupId);
    await sql`update lessons set status = 'published' where id = ${lessonId}`;
    return { newlyAssigned };
  });
}

/** archive: hide from children. restore: back to published when it
 * still has assignments, otherwise back to draft. Never deletes. */
export async function setLessonArchived(ctx: TenantContext, lessonId: string, archived: boolean): Promise<LessonStatus> {
  return withTenantContext(ctx, async (sql) => {
    const [row] = await sql<{ status: LessonStatus }[]>`
      update lessons l
      set status = case
        when ${archived} then 'archived'
        when exists (select 1 from lesson_assignments la where la.lesson_id = l.id) then 'published'
        else 'draft'
      end
      where l.id = ${lessonId} and l.author_id = ${ctx.userId}
      returning l.status
    `;
    if (!row) throw new LessonNotFoundError();
    return row.status;
  });
}

export type ChildLessonItem = {
  id: string;
  topic: string;
  ageBand: string;
  assignedAt: string;
  dueAt: string | null;
};

/** Children see exactly the published lessons assigned to their own
 * group — the query the child cabinet was missing entirely. */
export async function listLessonsForChild(ctx: TenantContext): Promise<ChildLessonItem[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ChildLessonItem[]>`
      select l.id, l.topic, l.age_band as "ageBand", max(la.assigned_at) as "assignedAt", min(la.due_at) as "dueAt"
      from lessons l
      join lesson_assignments la on la.lesson_id = l.id
      where l.status = 'published'
        and la.group_id = (select group_id from users where id = ${ctx.userId})
      group by l.id
      order by max(la.assigned_at) desc
    `
  );
}

export async function getLessonForChild(
  ctx: TenantContext,
  lessonId: string
): Promise<(ChildLessonItem & { content: LessonContent }) | null> {
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<ChildLessonItem[]>`
      select l.id, l.topic, l.age_band as "ageBand", max(la.assigned_at) as "assignedAt", min(la.due_at) as "dueAt"
      from lessons l
      join lesson_assignments la on la.lesson_id = l.id
      where l.id = ${lessonId}
        and l.status = 'published'
        and la.group_id = (select group_id from users where id = ${ctx.userId})
      group by l.id
    `;
    if (!rows[0]) return null;
    return { ...rows[0], content: foldArtifacts(await loadArtifacts(sql, lessonId)) };
  });
}
