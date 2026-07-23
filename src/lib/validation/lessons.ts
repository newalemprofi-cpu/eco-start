import { z } from "zod";

export const generateLessonSchema = z.object({
  topic: z.string().trim().min(2).max(120),
  ageBand: z.enum(["5-6", "6-7"]),
});
export type GenerateLessonInput = z.infer<typeof generateLessonSchema>;
