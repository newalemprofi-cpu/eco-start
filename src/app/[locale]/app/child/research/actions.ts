"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { addObservation, ResearchAccessError } from "@/db/repo/research";
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
  if (parsed.data.measurement == null && !parsed.data.note) return { ok: false as const, error: "empty" };

  const ctx = toTenantContext(session);
  try {
    // Checks the project is in the child's own group and still active.
    await addObservation(ctx, projectId, {
      measurement: parsed.data.measurement ?? null,
      note: parsed.data.note ?? null,
    });
  } catch (err) {
    if (err instanceof ResearchAccessError) return { ok: false as const, error: "forbidden" };
    throw err;
  }
  await awardXp(ctx, OBSERVATION_XP);

  revalidatePath(`/${locale}/app/child/research/${projectId}`);
  revalidatePath(`/${locale}/app/teacher/research`, "layout");
  return { ok: true as const, xpEarned: OBSERVATION_XP };
}
