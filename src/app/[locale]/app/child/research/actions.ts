"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { addObservation } from "@/db/repo/research";
import { awardXp } from "@/db/repo/xp";
import { addObservationSchema } from "@/lib/validation/research";

const OBSERVATION_XP = 7;

export async function addObservationAction(locale: string, projectId: string, formData: FormData) {
  const session = await requireRole("CHILD");
  const parsed = addObservationSchema.safeParse({
    measurement: formData.get("measurement") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: "validation" };

  const ctx = toTenantContext(session);
  await addObservation(ctx, projectId, {
    measurement: parsed.data.measurement ?? null,
    note: parsed.data.note ?? null,
  });
  await awardXp(ctx, OBSERVATION_XP);

  revalidatePath(`/${locale}/app/child/research/${projectId}`);
  return { ok: true as const };
}
