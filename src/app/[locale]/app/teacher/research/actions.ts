"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { createProject, setFeedback } from "@/db/repo/research";
import { getPrimaryGroup } from "@/db/repo/teacher";
import { createProjectSchema, feedbackSchema } from "@/lib/validation/research";

export async function createProjectAction(locale: string, formData: FormData) {
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);
  const group = await getPrimaryGroup(ctx);
  if (!group) return { ok: false as const, error: "no_group" };

  const parsed = createProjectSchema.safeParse({
    groupId: group.id,
    title: formData.get("title"),
    question: formData.get("question"),
    hypothesis: formData.get("hypothesis"),
    measurementUnit: formData.get("measurementUnit") || "cm",
  });
  if (!parsed.success) return { ok: false as const, error: "validation" };

  await createProject(ctx, parsed.data);
  revalidatePath(`/${locale}/app/teacher/research`);
  return { ok: true as const };
}

export async function setFeedbackAction(locale: string, projectId: string, formData: FormData) {
  const session = await requireRole("TEACHER");
  const parsed = feedbackSchema.safeParse({ feedback: formData.get("feedback") });
  if (!parsed.success) return { ok: false as const, error: "validation" };

  await setFeedback(toTenantContext(session), projectId, parsed.data.feedback);
  revalidatePath(`/${locale}/app/teacher/research`);
  return { ok: true as const };
}
