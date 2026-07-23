import { describe, expect, it } from "vitest";
import { isDevOnlyChain, selectProviderOrder } from "@/lib/ai/provider-selection";

describe("selectProviderOrder", () => {
  it("falls back to only the mock provider when no keys are configured", () => {
    const order = selectProviderOrder({});
    expect(order).toEqual(["mock"]);
    expect(isDevOnlyChain(order)).toBe(true);
  });

  it("orders providers Gemini -> Cloudflare -> OpenRouter -> mock, exactly as specified", () => {
    const order = selectProviderOrder({
      GEMINI_API_KEY: "g",
      CLOUDFLARE_ACCOUNT_ID: "a",
      CLOUDFLARE_AI_API_TOKEN: "t",
      OPENROUTER_API_KEY: "o",
    });
    expect(order).toEqual(["gemini", "cloudflare", "openrouter", "mock"]);
  });

  it("skips a provider whose credentials are only half-present", () => {
    const order = selectProviderOrder({ CLOUDFLARE_ACCOUNT_ID: "a" /* no token */ });
    expect(order).toEqual(["mock"]);
  });

  it("still puts mock last as the guaranteed fallback even with every key configured", () => {
    const order = selectProviderOrder({
      GEMINI_API_KEY: "g",
      OPENROUTER_API_KEY: "o",
    });
    expect(order.at(-1)).toBe("mock");
  });

  it("honors an explicit override, ignoring configured keys for other providers", () => {
    const order = selectProviderOrder({
      GEMINI_API_KEY: "g",
      OPENROUTER_API_KEY: "o",
      AI_PROVIDER_OVERRIDE: "openrouter",
    });
    expect(order).toEqual(["openrouter", "mock"]);
  });

  it("AI_PROVIDER_OVERRIDE=mock forces mock-only regardless of configured keys", () => {
    const order = selectProviderOrder({ GEMINI_API_KEY: "g", AI_PROVIDER_OVERRIDE: "mock" });
    expect(order).toEqual(["mock"]);
  });

  it("ignores blank/whitespace-only key values as \"not configured\"", () => {
    const order = selectProviderOrder({ GEMINI_API_KEY: "   " });
    expect(order).toEqual(["mock"]);
  });
});
