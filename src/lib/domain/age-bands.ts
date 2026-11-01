// Single source of truth for the age bands the AI lesson generator
// supports, and how each one shapes a generated lesson. Client-safe (no
// server-only imports): the AI Studio form, the zod schema, the prompt
// builder, the mock provider and the save action all read from here so
// they can never disagree about which bands exist.
//
// "5-6" and "6-7" predate this file and are kept as-is so existing
// lessons.age_band values stay valid.
import type { GroupAgeCategory } from "@/lib/group-age-categories";

export const AGE_BANDS = ["3-4", "4-5", "5-6", "6-7"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const DEFAULT_AGE_BAND: AgeBand = "5-6";

export type AgeBandProfile = {
  label: string;
  /** Total activity length in minutes, shown to the teacher. */
  durationMinutes: number;
  maxPlanSteps: number;
  maxQuizQuestions: number;
  maxQuizOptions: number;
  /** Fed verbatim into the AI prompt — describes how simple to be. */
  promptGuidance: string;
};

export const AGE_BAND_PROFILES: Record<AgeBand, AgeBandProfile> = {
  "3-4": {
    label: "3–4 жас",
    durationMinutes: 10,
    maxPlanSteps: 3,
    maxQuizQuestions: 2,
    maxQuizOptions: 2,
    promptGuidance:
      "Children are 3-4 years old and cannot read. Use very short sentences (3-6 words). Every step must be a game, song, movement or touching real objects. One idea per step. Quiz questions must be answerable by pointing at a picture, with 2 options only.",
  },
  "4-5": {
    label: "4–5 жас",
    durationMinutes: 15,
    maxPlanSteps: 4,
    maxQuizQuestions: 3,
    maxQuizOptions: 3,
    promptGuidance:
      "Children are 4-5 years old and do not read yet. Use short, simple sentences. Steps are playful: games, pictures, simple observation. Quiz has 3 options with picture-friendly answers.",
  },
  "5-6": {
    label: "5–6 жас",
    durationMinutes: 20,
    maxPlanSteps: 5,
    maxQuizQuestions: 3,
    maxQuizOptions: 3,
    promptGuidance:
      "Children are 5-6 years old. Simple language, short explanations, include a small hands-on experiment or observation.",
  },
  "6-7": {
    label: "6–7 жас",
    durationMinutes: 25,
    maxPlanSteps: 6,
    maxQuizQuestions: 3,
    maxQuizOptions: 3,
    promptGuidance:
      "Children are 6-7 years old (school preparation). Allow simple cause-and-effect reasoning, comparison and a small experiment with a conclusion.",
  },
};

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value);
}

/** Groups store a 3-tier category (0011 migration); lessons store a
 * band string. This maps a group to the band a teacher would pick. */
export const AGE_CATEGORY_TO_BAND: Record<GroupAgeCategory, AgeBand> = {
  MIDDLE_3: "3-4",
  SENIOR_4: "4-5",
  PRESCHOOL_5: "5-6",
};

export function ageBandToCategory(band: AgeBand): GroupAgeCategory {
  if (band === "3-4") return "MIDDLE_3";
  if (band === "4-5") return "SENIOR_4";
  return "PRESCHOOL_5";
}
