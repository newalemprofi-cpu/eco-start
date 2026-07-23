"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { recognizeNatureImage } from "@/lib/ai/gateway";
import { saveRecognition } from "@/db/repo/ecolab";
import { awardXp } from "@/db/repo/xp";
import { getStorageAdapter, StorageValidationError, validateImageUpload } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import type { AiLocale } from "@/lib/ai/types";

const RECOGNITION_XP = 8;
const RATE_LIMIT_PER_HOUR = Number(process.env.AI_GENERATION_RATE_LIMIT_PER_HOUR ?? 30);

export type AnalyzeResult =
  | {
      ok: true;
      label: string;
      kind: string;
      confidence: number;
      funFact: string;
      isPotentiallyToxic: boolean;
      provider: string;
      isMock: boolean;
      imageUrl: string;
      xpEarned: number;
    }
  | { ok: false; error: string };

export async function analyzeImageAction(locale: string, formData: FormData): Promise<AnalyzeResult> {
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);

  const { allowed } = rateLimit(`ecolab:${session.userId}`, RATE_LIMIT_PER_HOUR, 60 * 60 * 1000);
  if (!allowed) {
    return { ok: false, error: "rate_limited" };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "no_file" };
  }

  try {
    validateImageUpload({ type: file.type, size: file.size });
  } catch (err) {
    if (err instanceof StorageValidationError) {
      return { ok: false, error: "invalid_file" };
    }
    throw err;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  let recognition;
  try {
    recognition = await recognizeNatureImage(
      { locale: locale as AiLocale, imageBase64: base64, mimeType: file.type },
      { schoolId: ctx.schoolId, actorId: ctx.userId, locale: locale as AiLocale }
    );
  } catch {
    return { ok: false, error: "ai_unavailable" };
  }

  const storage = getStorageAdapter();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `recognitions/${ctx.schoolId}/${ctx.userId}/${Date.now()}.${ext}`;
  const { url } = await storage.putObject({ key, data: buffer, contentType: file.type });

  await saveRecognition(ctx, {
    kind: recognition.kind,
    imageUrl: url,
    confidence: recognition.confidence,
    label: recognition.label,
    funFact: recognition.funFact,
    isPotentiallyToxic: recognition.isPotentiallyToxic,
    provider: recognition.provider,
    isMock: recognition.isMock,
  });

  await awardXp(ctx, RECOGNITION_XP);

  revalidatePath(`/${locale}/app/child/ecolab`);
  revalidatePath(`/${locale}/app/child`);

  return {
    ok: true,
    label: recognition.label,
    kind: recognition.kind,
    confidence: recognition.confidence,
    funFact: recognition.funFact,
    isPotentiallyToxic: recognition.isPotentiallyToxic,
    provider: recognition.provider,
    isMock: recognition.isMock,
    imageUrl: url,
    xpEarned: RECOGNITION_XP,
  };
}
