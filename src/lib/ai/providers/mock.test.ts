import { describe, expect, it } from "vitest";
import { MockAiProvider } from "@/lib/ai/providers/mock";

describe("MockAiProvider determinism", () => {
  const provider = new MockAiProvider();

  it("is flagged as a mock provider", () => {
    expect(provider.isMock).toBe(true);
    expect(provider.id).toBe("mock");
  });

  it("returns the exact same recognition for the exact same image input", async () => {
    const input = { locale: "kk" as const, imageBase64: "AAAA", mimeType: "image/jpeg" };
    const a = await provider.recognizeImage(input);
    const b = await provider.recognizeImage(input);
    expect(a).toEqual(b);
  });

  it("returns different results for meaningfully different images (not a constant)", async () => {
    const a = await provider.recognizeImage({
      locale: "kk",
      imageBase64: "A".repeat(10),
      mimeType: "image/jpeg",
    });
    const b = await provider.recognizeImage({
      locale: "kk",
      imageBase64: "A".repeat(500),
      mimeType: "image/png",
    });
    expect(a.label).not.toBe(b.label);
  });

  it("always returns a confidence within [0, 1]", async () => {
    const result = await provider.recognizeImage({
      locale: "en",
      imageBase64: "some-bytes",
      mimeType: "image/webp",
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("generates a lesson bundle with the requested topic reflected in the title", async () => {
    const bundle = await provider.generateLesson({ locale: "en", topic: "Ocean life", ageBand: "5-6" });
    expect(bundle.title).toContain("Ocean life");
    expect(bundle.quiz.length).toBeGreaterThan(0);
  });
});
