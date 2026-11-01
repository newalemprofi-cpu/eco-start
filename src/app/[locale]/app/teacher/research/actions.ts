"use server";

import { revalidatePath } from "next/cache";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import {
  createProject,
  ResearchAccessError,
  setFeedback,
  setProjectStatus,
  updateProject,
} from "@/db/repo/research";
import {
  createProjectSchema,
  feedbackSchema,
  setProjectStatusSchema,
  updateProjectSchema,
} from "@/lib/validation/research";

export type ResearchActionResult = { ok: true } | { ok: false; error: string };

const VALIDATION_ERROR =
  "Тексеріңіз: тақырып 2–120 таңба, сұрақ пен болжам 2–240 таңба, ең көбі 6 тапсырма, топ таңдалған.";

function fields(formData: FormData) {
  return {
    groupId: formData.get("groupId"),
    title: formData.get("title"),
    question: formData.get("question"),
    hypothesis: formData.get("hypothesis"),
    measurementUnit: formData.get("measurementUnit") || "cm",
    tasks: formData.get("tasks") ?? "",
  };
}

function revalidateResearch(locale: string) {
  revalidatePath(`/${locale}/app/teacher/research`, "layout");
  revalidatePath(`/${locale}/app/child/research`, "layout");
}

async function guarded(fn: () => Promise<void>): Promise<ResearchActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    if (err instanceof ResearchAccessError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function createProjectAction(locale: string, formData: FormData): Promise<ResearchActionResult> {
  const session = await requireRole("TEACHER");
  const parsed = createProjectSchema.safeParse({
    ...fields(formData),
    status: formData.get("status") === "draft" ? "draft" : "active",
  });
  if (!parsed.success) return { ok: false, error: VALIDATION_ERROR };

  const result = await guarded(() => createProject(toTenantContext(session), parsed.data).then(() => undefined));
  if (result.ok) revalidateResearch(locale);
  return result;
}

export async function updateProjectAction(
  locale: string,
  projectId: string,
  formData: FormData
): Promise<ResearchActionResult> {
  const session = await requireRole("TEACHER");
  const parsed = updateProjectSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: VALIDATION_ERROR };

  const result = await guarded(() => updateProject(toTenantContext(session), projectId, parsed.data));
  if (result.ok) revalidateResearch(locale);
  return result;
}

export async function setProjectStatusAction(
  locale: string,
  projectId: string,
  input: { status: string; conclusion?: string }
): Promise<ResearchActionResult> {
  const session = await requireRole("TEACHER");
  const parsed = setProjectStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Күйі дұрыс емес." };

  const result = await guarded(() =>
    setProjectStatus(toTenantContext(session), projectId, parsed.data.status, parsed.data.conclusion || undefined)
  );
  if (result.ok) revalidateResearch(locale);
  return result;
}

export async function setFeedbackAction(
  locale: string,
  projectId: string,
  formData: FormData
): Promise<ResearchActionResult> {
  const session = await requireRole("TEACHER");
  const parsed = feedbackSchema.safeParse({ feedback: formData.get("feedback") });
  if (!parsed.success) return { ok: false, error: "Пікір 1–500 таңба болуы керек." };

  const result = await guarded(() => setFeedback(toTenantContext(session), projectId, parsed.data.feedback));
  if (result.ok) revalidateResearch(locale);
  return result;
}
