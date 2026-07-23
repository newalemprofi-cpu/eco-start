import { z } from "zod";

/** Validates and loosely-parses model text output that was prompted to
 * be JSON-only. Real models occasionally wrap JSON in markdown code
 * fences or add stray whitespace/text — this strips that before
 * validating, so a provider isn't marked "broken" for a cosmetic slip. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export const RecognitionSchema = z.object({
  label: z.string().min(1),
  kind: z.enum(["PLANT", "ANIMAL", "LEAF", "OBJECT"]),
  confidence: z.number().min(0).max(1),
  funFact: z.string().min(1),
  isPotentiallyToxic: z.boolean(),
});

export const LessonSchema = z.object({
  title: z.string().min(1),
  ageBand: z.string().min(1),
  objective: z.string().min(1),
  plan: z.array(z.string().min(1)).min(1),
  quiz: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
        correctIndex: z.number().int().min(0),
      })
    )
    .min(1),
  homeworkTip: z.string().min(1),
});

export const StorySchema = z.object({
  title: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(1),
});

export const StoryboardSchema = z.object({
  title: z.string().min(1),
  scenes: z
    .array(
      z.object({
        scene: z.number().int().min(1),
        description: z.string().min(1),
        narration: z.string().min(1),
      })
    )
    .min(1),
});
