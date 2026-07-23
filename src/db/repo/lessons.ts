import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import type { LessonBundle } from "@/lib/ai/types";
import type { GroupAgeCategory } from "@/lib/group-age-categories";

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
    groupId?: string;
    /** Empty = "барлық санат" (shown regardless of group), same
     * convention as games.age_categories — auto-derived from the
     * publishing teacher's group when one is set (see ai-studio/actions.ts). */
    ageCategories?: GroupAgeCategory[];
  }
): Promise<{ id: string }> {
  return withTenantContext(ctx, async (sql) => {
    const [lesson] = await sql<{ id: string }[]>`
      insert into lessons (school_id, author_id, topic, locale, age_band, status, age_categories)
      values (
        ${ctx.schoolId}, ${ctx.userId}, ${input.topic}, ${input.locale}, ${input.ageBand}, ${input.status},
        ${input.ageCategories ?? []}::group_age_category[]
      )
      returning id
    `;

    await sql`
      insert into lesson_artifacts (lesson_id, type, content, ai_provider, ai_is_mock)
      values
        (${lesson.id}, 'LESSON_PLAN', ${JSON.stringify({ objective: input.bundle.objective, plan: input.bundle.plan })}, ${input.provider}, ${input.isMock}),
        (${lesson.id}, 'QUIZ', ${JSON.stringify({ questions: input.bundle.quiz })}, ${input.provider}, ${input.isMock}),
        (${lesson.id}, 'HOMEWORK', ${JSON.stringify({ tip: input.bundle.homeworkTip })}, ${input.provider}, ${input.isMock})
    `;

    if (input.status === "published" && input.groupId) {
      await sql`insert into lesson_assignments (lesson_id, group_id) values (${lesson.id}, ${input.groupId})`;
    }

    return lesson;
  });
}

export type LessonListItem = {
  id: string;
  topic: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  ageBand: string;
  ageCategories: GroupAgeCategory[];
};

export async function listLessons(ctx: TenantContext): Promise<LessonListItem[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<LessonListItem[]>`
      select id, topic, status, created_at as "createdAt", age_band as "ageBand", age_categories as "ageCategories"
      from lessons
      where author_id = ${ctx.userId}
      order by created_at desc
    `
  );
}

export type LessonDetail = LessonListItem & {
  artifacts: { type: string; content: Record<string, unknown> }[];
};

export async function getLesson(ctx: TenantContext, lessonId: string): Promise<LessonDetail | null> {
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<LessonListItem[]>`
      select id, topic, status, created_at as "createdAt", age_band as "ageBand", age_categories as "ageCategories"
      from lessons where id = ${lessonId}
    `;
    if (!rows[0]) return null;
    const artifacts = await sql<{ type: string; content: Record<string, unknown> }[]>`
      select type, content from lesson_artifacts where lesson_id = ${lessonId}
    `;
    return { ...rows[0], artifacts };
  });
}
