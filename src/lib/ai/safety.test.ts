import { describe, expect, it } from "vitest";
import { enforceRecognitionSafety, sanitizeText } from "@/lib/ai/safety";
import type { RecognitionOutput } from "@/lib/ai/types";

function baseRecognition(overrides: Partial<RecognitionOutput> = {}): RecognitionOutput {
  return {
    label: "Ромашка",
    kind: "PLANT",
    confidence: 0.9,
    funFact: "Гүлдері дәрі шайға қолданылады.",
    isPotentiallyToxic: false,
    ...overrides,
  };
}

describe("sanitizeText", () => {
  it("strips a bare 'safe to eat' claim and appends a caution note", () => {
    const out = sanitizeText("This mushroom is safe to eat.", "en");
    expect(out.toLowerCase()).not.toContain("safe to eat");
    expect(out).toContain("⚠️");
  });

  it("catches the Kazakh and Russian phrasing too, not just English", () => {
    expect(sanitizeText("Бұны жеуге болады", "kk")).toContain("⚠️");
    expect(sanitizeText("Это можно есть", "ru")).toContain("⚠️");
  });

  it("leaves ordinary safe text untouched", () => {
    const text = "Бұл көбелек әдемі және пайдалы.";
    expect(sanitizeText(text, "kk")).toBe(text);
  });
});

describe("enforceRecognitionSafety", () => {
  it("never lets a low-confidence result read as a bare identification", () => {
    const out = enforceRecognitionSafety(baseRecognition({ confidence: 0.4 }), "kk");
    expect(out.isPotentiallyToxic).toBe(true); // low confidence forces caution, even if the model said false
    expect(out.funFact).toContain("Дәлірек білу үшін тәрбиешіңнен сұра");
  });

  it("keeps a high-confidence, non-toxic result cheerful but still recommends checking with a teacher", () => {
    const out = enforceRecognitionSafety(baseRecognition({ confidence: 0.95 }), "kk");
    expect(out.isPotentiallyToxic).toBe(false);
    expect(out.funFact).toContain("тәрбиешіңнен сұра");
  });

  it("keeps isPotentiallyToxic=true even when confidence is high, if the model itself flagged it", () => {
    const out = enforceRecognitionSafety(
      baseRecognition({ confidence: 0.97, isPotentiallyToxic: true, label: "Мухомор" }),
      "ru"
    );
    expect(out.isPotentiallyToxic).toBe(true);
  });

  it("never produces an unqualified 'safe to eat/touch' claim regardless of input", () => {
    const out = enforceRecognitionSafety(
      baseRecognition({ funFact: "This plant is safe to eat and touch.", confidence: 0.99 }),
      "en"
    );
    expect(out.funFact.toLowerCase()).not.toContain("safe to eat");
  });
});
