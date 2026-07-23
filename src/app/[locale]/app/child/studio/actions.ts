"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { generateEcoStory, generateEcoStoryboard } from "@/lib/ai/gateway";
import { createMediaProject } from "@/db/repo/media";
import { awardXp } from "@/db/repo/xp";
import { getStorageAdapter, StorageValidationError, validateImageUpload } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import type { AiLocale, StoryboardOutput, StoryOutput } from "@/lib/ai/types";

const RATE_LIMIT_PER_HOUR = Number(process.env.AI_GENERATION_RATE_LIMIT_PER_HOUR ?? 30);
const topicSchema = z.string().trim().min(2).max(120);

export type StoryResult = { ok: true; story: StoryOutput; isMock: boolean } | { ok: false; error: string };
export type StoryboardResult =
  | { ok: true; storyboard: StoryboardOutput; isMock: boolean }
  | { ok: false; error: string };

export async function generateStoryAction(locale: string, topic: string): Promise<StoryResult> {
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  const { allowed } = rateLimit(`story-gen:${session.userId}`, RATE_LIMIT_PER_HOUR, 60 * 60 * 1000);
  if (!allowed) return { ok: false, error: "rate_limited" };

  const parsed = topicSchema.safeParse(topic);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await generateEcoStory(
      { locale: locale as AiLocale, topic: parsed.data },
      { schoolId: ctx.schoolId, actorId: ctx.userId, locale: locale as AiLocale }
    );
    return { ok: true, story: result, isMock: result.isMock };
  } catch {
    return { ok: false, error: "ai_unavailable" };
  }
}

export async function generateStoryboardAction(locale: string, storyText: string): Promise<StoryboardResult> {
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  const { allowed } = rateLimit(`storyboard-gen:${session.userId}`, RATE_LIMIT_PER_HOUR, 60 * 60 * 1000);
  if (!allowed) return { ok: false, error: "rate_limited" };

  try {
    const result = await generateEcoStoryboard(
      { locale: locale as AiLocale, topic: "storyboard", storyText },
      { schoolId: ctx.schoolId, actorId: ctx.userId, locale: locale as AiLocale }
    );
    return { ok: true, storyboard: result, isMock: result.isMock };
  } catch {
    return { ok: false, error: "ai_unavailable" };
  }
}

export async function saveStoryProjectAction(
  locale: string,
  input: { title: string; story: StoryOutput; storyboard: StoryboardOutput | null; isMock: boolean }
) {
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);

  await createMediaProject(ctx, {
    type: input.storyboard ? "STORYBOARD" : "DIGITAL_BOOK",
    title: input.title,
    scriptText: input.story.paragraphs.join("\n\n"),
    storyboard: input.storyboard,
    fileUrl: null,
    provider: "gateway",
    isMock: input.isMock,
  });
  await awardXp(ctx, 10);

  revalidatePath(`/${locale}/app/child/studio`);
  return { ok: true as const };
}

export async function uploadMediaAction(locale: string, formData: FormData) {
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);

  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");
  if (!title || !(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "invalid" };
  }

  try {
    validateImageUpload({ type: file.type, size: file.size });
  } catch (err) {
    if (err instanceof StorageValidationError) return { ok: false as const, error: "invalid_file" };
    throw err;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorageAdapter();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `media/${ctx.schoolId}/${ctx.userId}/${Date.now()}.${ext}`;
  const { url } = await storage.putObject({ key, data: buffer, contentType: file.type });

  await createMediaProject(ctx, {
    type: "PRESENTATION",
    title,
    scriptText: null,
    storyboard: null,
    fileUrl: url,
    provider: null,
    isMock: false,
  });
  await awardXp(ctx, 6);

  revalidatePath(`/${locale}/app/child/studio`);
  return { ok: true as const };
}
