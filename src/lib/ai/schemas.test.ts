import { describe, expect, it } from "vitest";
import { extractJson, RecognitionSchema } from "@/lib/ai/schemas";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips a markdown code fence around the JSON, as real models often add one", () => {
    const text = '```json\n{"a": 1}\n```';
    expect(extractJson(text)).toEqual({ a: 1 });
  });

  it("ignores leading/trailing prose around the JSON object", () => {
    const text = 'Here is the result:\n{"a": 1}\nHope that helps!';
    expect(extractJson(text)).toEqual({ a: 1 });
  });

  it("throws a clear error when there is no JSON object at all", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("RecognitionSchema", () => {
  it("accepts a well-formed recognition payload", () => {
    const result = RecognitionSchema.safeParse({
      label: "Ромашка",
      kind: "PLANT",
      confidence: 0.8,
      funFact: "fact",
      isPotentiallyToxic: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a confidence value outside [0, 1] — a model hallucinating '95' instead of 0.95", () => {
    const result = RecognitionSchema.safeParse({
      label: "Ромашка",
      kind: "PLANT",
      confidence: 95,
      funFact: "fact",
      isPotentiallyToxic: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown `kind` value", () => {
    const result = RecognitionSchema.safeParse({
      label: "Ромашка",
      kind: "MINERAL",
      confidence: 0.5,
      funFact: "fact",
      isPotentiallyToxic: false,
    });
    expect(result.success).toBe(false);
  });
});
