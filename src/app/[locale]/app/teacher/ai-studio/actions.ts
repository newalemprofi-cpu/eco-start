"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { generateLessonBundle } from "@/lib/ai/gateway";
import { createLessonWithArtifacts } from "@/db/repo/lessons";
import { getPrimaryGroup } from "@/db/repo/teacher";
import { rateLimit } from "@/lib/rate-limit";
import { generateLessonSchema } from "@/lib/validation/lessons";
import type { AiLocale, LessonBundle } from "@/lib/ai/types";

const RATE_LIMIT_PER_HOUR = Number(process.env.AI_GENERATION_RATE_LIMIT_PER_HOUR ?? 30);

export type GenerateLessonResult =
  | { ok: true; bundle: LessonBundle; provider: string; isMock: boolean }
  | { ok: false; error: string };

export async function generateLessonAction(locale: string, formData: FormData): Promise<GenerateLessonResult> {
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);

  const { allowed } = rateLimit(`lesson-gen:${session.userId}`, RATE_LIMIT_PER_HOUR, 60 * 60 * 1000);
  if (!allowed) return { ok: false, error: "rate_limited" };

  const parsed = generateLessonSchema.safeParse({
    topic: formData.get("topic"),
    ageBand: formData.get("ageBand"),
  });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await generateLessonBundle(
      { locale: locale as AiLocale, topic: parsed.data.topic, ageBand: parsed.data.ageBand },
      { schoolId: ctx.schoolId, actorId: ctx.userId, locale: locale as AiLocale }
    );
    return {
      ok: true,
      bundle: result,
      provider: result.provider,
      isMock: result.isMock,
    };
  } catch {
    return { ok: false, error: "ai_unavailable" };
  }
}

export async function saveLessonAction(
  locale: string,
  input: {
    topic: string;
    ageBand: string;
    bundle: LessonBundle;
    provider: string;
    isMock: boolean;
    publish: boolean;
  }
) {
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);
  const group = input.publish ? await getPrimaryGroup(ctx) : null;

  await createLessonWithArtifacts(ctx, {
    topic: input.topic,
    locale: locale as "kk" | "ru" | "en",
    ageBand: input.ageBand,
    bundle: input.bundle,
    isMock: input.isMock,
    provider: input.provider,
    status: input.publish ? "published" : "draft",
    groupId: group?.id,
    ageCategories: group ? [group.ageCategory] : [],
  });

  revalidatePath(`/${locale}/app/teacher/ai-studio`);
  return { ok: true as const };
}
