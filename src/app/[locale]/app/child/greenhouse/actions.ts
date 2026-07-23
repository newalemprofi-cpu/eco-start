"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { addGrowthLog, createEntry, markWatered } from "@/db/repo/greenhouse";
import { awardXp } from "@/db/repo/xp";
import { addGrowthLogSchema, createPlantSchema } from "@/lib/validation/greenhouse";

const PLANT_ADDED_XP = 5;
const OBSERVATION_XP = 6;

export async function createPlantAction(locale: string, formData: FormData) {
  const session = await requireRole("CHILD");
  const parsed = createPlantSchema.safeParse({
    nickname: formData.get("nickname"),
    waterSchedule: formData.get("waterSchedule"),
  });
  if (!parsed.success) return { ok: false as const, error: "validation" };

  const ctx = toTenantContext(session);
  await createEntry(ctx, parsed.data);
  await awardXp(ctx, PLANT_ADDED_XP);
  revalidatePath(`/${locale}/app/child/greenhouse`);
  return { ok: true as const };
}

export async function markWateredAction(locale: string, entryId: string) {
  const session = await requireRole("CHILD");
  await markWatered(toTenantContext(session), entryId);
  revalidatePath(`/${locale}/app/child/greenhouse`);
}

export async function addGrowthLogAction(locale: string, entryId: string, formData: FormData) {
  const session = await requireRole("CHILD");
  const parsed = addGrowthLogSchema.safeParse({
    heightCm: formData.get("heightCm") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: "validation" };

  const ctx = toTenantContext(session);
  await addGrowthLog(ctx, entryId, {
    heightCm: parsed.data.heightCm ?? null,
    note: parsed.data.note ?? null,
  });
  await awardXp(ctx, OBSERVATION_XP);
  revalidatePath(`/${locale}/app/child/greenhouse/${entryId}`);
  return { ok: true as const };
}
