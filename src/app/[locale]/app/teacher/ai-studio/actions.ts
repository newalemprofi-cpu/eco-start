"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { generateLessonBundle } from "@/lib/ai/gateway";
import { LessonSchema } from "@/lib/ai/schemas";
import { signPayload, verifyPayload, type SignedPayload } from "@/lib/ai/signed-payload";
import {
  createLessonWithArtifacts,
  GroupNotOwnedError,
  LessonNotFoundError,
  publishLessonToGroup,
  setLessonArchived,
} from "@/db/repo/lessons";
import { listTeacherGroups } from "@/db/repo/teacher";
import { rateLimit } from "@/lib/rate-limit";
import { generateLessonSchema, lessonIdSchema, publishLessonSchema } from "@/lib/validation/lessons";
import { ageBandToCategory, type AgeBand } from "@/lib/domain/age-bands";
import type { AiLocale, LessonBundle } from "@/lib/ai/types";

const RATE_LIMIT_PER_HOUR = Number(process.env.AI_GENERATION_RATE_LIMIT_PER_HOUR ?? 30);
/** A generated lesson can be saved for this long before it must be regenerated. */
const SIGNED_LESSON_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type GeneratedLesson = {
  topic: string;
  ageBand: AgeBand;
  bundle: LessonBundle;
  provider: string;
  isMock: boolean;
};

export type GenerateLessonResult =
  | { ok: true; lesson: SignedPayload<GeneratedLesson> }
  | { ok: false; error: string };

export type LessonActionResult = { ok: true; message: string } | { ok: false; error: string };

function signingSecret(): string {
  // Domain-separated from the session JWT key that SESSION_SECRET also feeds.
  return `${process.env.SESSION_SECRET ?? ""}:ai-lesson-v1`;
}

function revalidateLessonViews(locale: string) {
  revalidatePath(`/${locale}/app/teacher/ai-studio`, "layout");
  revalidatePath(`/${locale}/app/teacher`);
  revalidatePath(`/${locale}/app/child/lessons`, "layout");
  revalidatePath(`/${locale}/app/parent/homework`);
}

export async function generateLessonAction(locale: string, formData: FormData): Promise<GenerateLessonResult> {
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);

  const { allowed } = rateLimit(`lesson-gen:${session.userId}`, RATE_LIMIT_PER_HOUR, 60 * 60 * 1000);
  if (!allowed) return { ok: false, error: "Сағаттық шекке жеттіңіз. Сәлден соң қайталаңыз." };

  const parsed = generateLessonSchema.safeParse({
    topic: formData.get("topic"),
    ageBand: formData.get("ageBand"),
  });
  if (!parsed.success) return { ok: false, error: "Тақырып (2–120 таңба) мен жас тобын тексеріңіз." };

  try {
    const result = await generateLessonBundle(
      { locale: locale as AiLocale, topic: parsed.data.topic, ageBand: parsed.data.ageBand },
      { schoolId: ctx.schoolId, actorId: ctx.userId, locale: locale as AiLocale }
    );
    const { provider, isMock, ...bundle } = result;
    const lesson: GeneratedLesson = {
      topic: parsed.data.topic,
      ageBand: parsed.data.ageBand,
      bundle,
      provider,
      isMock,
    };
    return { ok: true, lesson: signPayload(signingSecret(), session.userId, lesson) };
  } catch {
    return { ok: false, error: "AI қызметі уақытша қолжетімсіз. Кейінірек қайталаңыз." };
  }
}

/** Saves a freshly generated lesson. `groupId` null = draft; otherwise
 * it is published to that group, which must belong to the teacher. */
export async function saveLessonAction(
  locale: string,
  input: { lesson: SignedPayload<GeneratedLesson>; groupId: string | null }
): Promise<LessonActionResult> {
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);

  if (!verifyPayload(signingSecret(), session.userId, input.lesson, SIGNED_LESSON_MAX_AGE_MS)) {
    return { ok: false, error: "Жасалған материалдың мерзімі өтті немесе өзгертілген. Қайта жасаңыз." };
  }
  const { topic, ageBand, provider, isMock } = input.lesson.data;
  const bundle = LessonSchema.safeParse(input.lesson.data.bundle);
  if (!bundle.success) return { ok: false, error: "Материал құрылымы дұрыс емес. Қайта жасаңыз." };

  let groupId: string | undefined;
  if (input.groupId) {
    const groups = await listTeacherGroups(ctx);
    const group = groups.find((g) => g.id === input.groupId);
    if (!group) return { ok: false, error: "Таңдалған топ сізге бекітілмеген." };
    groupId = group.id;
  }

  try {
    await createLessonWithArtifacts(ctx, {
      topic,
      locale: locale as "kk" | "ru" | "en",
      ageBand,
      bundle: bundle.data,
      isMock,
      provider,
      status: groupId ? "published" : "draft",
      groupId,
      ageCategories: [ageBandToCategory(ageBand)],
    });
  } catch (err) {
    if (err instanceof GroupNotOwnedError) return { ok: false, error: err.message };
    throw err;
  }

  revalidateLessonViews(locale);
  return { ok: true, message: groupId ? "Топқа жарияланды — балалар енді көреді." : "Жоба ретінде сақталды." };
}

/** Publishes an already-saved lesson (draft, archived, or an old
 * "published" lesson that never reached a group) to one of the
 * teacher's groups. */
export async function publishExistingLessonAction(
  locale: string,
  input: { lessonId: string; groupId: string }
): Promise<LessonActionResult> {
  const session = await requireRole("TEACHER");
  const parsed = publishLessonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Топты таңдаңыз." };

  try {
    const { newlyAssigned } = await publishLessonToGroup(
      toTenantContext(session),
      parsed.data.lessonId,
      parsed.data.groupId
    );
    revalidateLessonViews(locale);
    return { ok: true, message: newlyAssigned ? "Топқа жарияланды." : "Бұл топқа бұрыннан жарияланған." };
  } catch (err) {
    if (err instanceof GroupNotOwnedError || err instanceof LessonNotFoundError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

export async function setLessonArchivedAction(
  locale: string,
  input: { lessonId: string; archived: boolean }
): Promise<LessonActionResult> {
  const session = await requireRole("TEACHER");
  const parsed = lessonIdSchema.safeParse(input.lessonId);
  if (!parsed.success) return { ok: false, error: "Материал табылмады." };

  try {
    const status = await setLessonArchived(toTenantContext(session), parsed.data, input.archived === true);
    revalidateLessonViews(locale);
    return {
      ok: true,
      message: status === "archived" ? "Архивке жіберілді — балалар көрмейді." : "Қалпына келтірілді.",
    };
  } catch (err) {
    if (err instanceof LessonNotFoundError) return { ok: false, error: err.message };
    throw err;
  }
}
