import { describe, expect, it } from "vitest";
import { normalizeLessonForAge } from "@/lib/ai/lesson-normalize";
import { MockAiProvider } from "@/lib/ai/providers/mock";
import { lessonPrompt } from "@/lib/ai/prompts";
import { AGE_BAND_PROFILES, AGE_BANDS, ageBandToCategory, AGE_CATEGORY_TO_BAND } from "@/lib/domain/age-bands";
import { generateLessonSchema } from "@/lib/validation/lessons";
import type { LessonBundle } from "@/lib/ai/types";

const bigBundle: LessonBundle = {
  title: "T",
  ageBand: "6-7",
  objective: "O",
  plan: ["1", "2", "3", "4", "5", "6", "7"],
  quiz: [
    { question: "Q1", options: ["a", "b", "c", "d"], correctIndex: 3 },
    { question: "Q2", options: ["a", "b"], correctIndex: 0 },
    { question: "Q3", options: ["a", "b", "c"], correctIndex: 1 },
    { question: "Q4", options: ["a", "b", "c"], correctIndex: 9 },
  ],
  homeworkTip: "H",
};

describe("normalizeLessonForAge", () => {
  it("trims a lesson to the 3-4 profile and keeps the correct answer", () => {
    const out = normalizeLessonForAge(bigBundle, "3-4");
    const p = AGE_BAND_PROFILES["3-4"];
    expect(out.ageBand).toBe("3-4");
    expect(out.plan).toHaveLength(p.maxPlanSteps);
    expect(out.quiz).toHaveLength(p.maxQuizQuestions);
    expect(out.durationMinutes).toBe(p.durationMinutes);
    for (const q of out.quiz) expect(q.options.length).toBeLessThanOrEqual(p.maxQuizOptions);
    // Q1's correct answer was "d" — it must survive the trim.
    expect(out.quiz[0].options[out.quiz[0].correctIndex]).toBe("d");
  });

  it("clamps an out-of-range correctIndex instead of pointing nowhere", () => {
    const out = normalizeLessonForAge(bigBundle, "6-7");
    for (const q of out.quiz) expect(q.correctIndex).toBeLessThan(q.options.length);
  });

  it("leaves a lesson already within limits unchanged in shape", () => {
    const out = normalizeLessonForAge({ ...bigBundle, plan: ["a", "b"], quiz: [bigBundle.quiz[1]] }, "5-6");
    expect(out.plan).toEqual(["a", "b"]);
    expect(out.quiz[0]).toEqual(bigBundle.quiz[1]);
  });
});

describe("age bands", () => {
  it("accepts every band in the schema, including the new 3-4 and the legacy 6-7", () => {
    for (const band of AGE_BANDS) {
      expect(generateLessonSchema.safeParse({ topic: "Су", ageBand: band }).success).toBe(true);
    }
    expect(generateLessonSchema.safeParse({ topic: "Су", ageBand: "2-3" }).success).toBe(false);
  });

  it("maps group categories to bands and back", () => {
    expect(AGE_CATEGORY_TO_BAND.MIDDLE_3).toBe("3-4");
    expect(ageBandToCategory("3-4")).toBe("MIDDLE_3");
    expect(ageBandToCategory("4-5")).toBe("SENIOR_4");
    expect(ageBandToCategory("6-7")).toBe("PRESCHOOL_5");
  });

  it("puts the band's limits and guidance into the AI prompt", () => {
    const prompt = lessonPrompt("kk", "Күз", "3-4");
    expect(prompt).toContain("3-4");
    expect(prompt).toContain("at most 3 short steps");
    expect(prompt).toContain("cannot read");
  });

  it("mock provider + normalization yields a short, game-based 3-4 lesson", async () => {
    const raw = await new MockAiProvider().generateLesson({ locale: "kk", topic: "Күз", ageBand: "3-4" });
    const out = normalizeLessonForAge(raw, "3-4");
    expect(out.plan.length).toBeLessThanOrEqual(3);
    expect(out.plan.join(" ")).toMatch(/ойын/i);
    expect(out.quiz[0].options).toHaveLength(2);
  });
});
