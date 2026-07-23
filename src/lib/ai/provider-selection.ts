import type { ProviderId } from "@/lib/ai/types";

/**
 * Pure provider-priority decision logic, deliberately separated from
 * gateway.ts (which imports `server-only` + the DB client and so can't
 * be unit-tested directly). Takes a plain env-like object instead of
 * reading `process.env` itself, so provider fallback behavior — the
 * spec's most safety-critical piece of AI logic — has a real,
 * fast, dependency-free unit test. See src/lib/ai/gateway.ts for the
 * runtime caller and provider-selection.test.ts for the tests.
 */
export type AiEnv = {
  AI_PROVIDER_OVERRIDE?: string;
  GEMINI_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_API_TOKEN?: string;
  OPENROUTER_API_KEY?: string;
};

export function selectProviderOrder(env: AiEnv): ProviderId[] {
  const override = env.AI_PROVIDER_OVERRIDE?.trim() as ProviderId | undefined;
  if (override === "mock") return ["mock"];

  const order: ProviderId[] = [];

  if (env.GEMINI_API_KEY?.trim() && (!override || override === "gemini")) {
    order.push("gemini");
  }
  if (
    env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
    env.CLOUDFLARE_AI_API_TOKEN?.trim() &&
    (!override || override === "cloudflare")
  ) {
    order.push("cloudflare");
  }
  if (env.OPENROUTER_API_KEY?.trim() && (!override || override === "openrouter")) {
    order.push("openrouter");
  }

  // Mock is always present and always last: the one candidate in the
  // chain that can never fail, guaranteeing the app works with zero
  // paid API keys configured.
  order.push("mock");
  return order;
}

export function isDevOnlyChain(order: ProviderId[]): boolean {
  return order.length === 1 && order[0] === "mock";
}
