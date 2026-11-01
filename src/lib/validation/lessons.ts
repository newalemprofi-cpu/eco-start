import { z } from "zod";
import { AGE_BANDS } from "@/lib/domain/age-bands";

export const generateLessonSchema = z.object({
  topic: z.string().trim().min(2).max(120),
  ageBand: z.enum(AGE_BANDS),
});
export type GenerateLessonInput = z.infer<typeof generateLessonSchema>;

export const lessonIdSchema = z.string().uuid();

/** Publishing always names the target group explicitly — the action
 * checks it belongs to the signed-in teacher (teacher_groups). */
export const publishLessonSchema = z.object({
  lessonId: lessonIdSchema,
  groupId: z.string().uuid(),
});
