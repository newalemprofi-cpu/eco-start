import { AGE_BAND_PROFILES, type AgeBand } from "@/lib/domain/age-bands";
import type { LessonBundle } from "@/lib/ai/types";

/**
 * Real models don't reliably respect "3 steps, 2 options" in a prompt,
 * so the age band's limits are enforced again on the output: a 3-4
 * year-old lesson never ships with six steps or a four-option quiz
 * just because the provider ignored the instruction. Pure — shared by
 * the gateway (on generation) and its unit test.
 */
export function normalizeLessonForAge(bundle: LessonBundle, band: AgeBand): LessonBundle {
  const profile = AGE_BAND_PROFILES[band];

  const quiz = bundle.quiz.slice(0, profile.maxQuizQuestions).map((q) => {
    const correctIndex = Math.min(Math.max(q.correctIndex, 0), q.options.length - 1);
    if (q.options.length <= profile.maxQuizOptions) return { ...q, correctIndex };
    // Keep the correct answer, then fill with the first distractors.
    const correct = q.options[correctIndex];
    const distractors = q.options.filter((_, i) => i !== correctIndex).slice(0, profile.maxQuizOptions - 1);
    const insertAt = Math.min(correctIndex, distractors.length);
    const options = [...distractors.slice(0, insertAt), correct, ...distractors.slice(insertAt)];
    return { ...q, options, correctIndex: insertAt };
  });

  return {
    ...bundle,
    ageBand: band,
    plan: bundle.plan.slice(0, profile.maxPlanSteps),
    quiz,
    durationMinutes: profile.durationMinutes,
  };
}
