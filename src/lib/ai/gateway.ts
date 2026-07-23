import "server-only";
import { CloudflareAiProvider } from "@/lib/ai/providers/cloudflare";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { MockAiProvider } from "@/lib/ai/providers/mock";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import { enforceChatSafety, enforceRecognitionSafety } from "@/lib/ai/safety";
import { isDevOnlyChain, selectProviderOrder, type AiEnv } from "@/lib/ai/provider-selection";
import type {
  AiCapability,
  AiProvider,
  ChatInput,
  ChatOutput,
  LessonBundle,
  ProviderId,
  RecognitionInput,
  RecognitionOutput,
  StoryboardOutput,
  StructuredInput,
  StoryOutput,
} from "@/lib/ai/types";
import { withSystemContext } from "@/db/client";

const mock = new MockAiProvider();

/**
 * Provider priority, exactly as specified: Gemini -> Cloudflare Workers
 * AI -> OpenRouter -> deterministic mock. Only providers with the
 * required environment variables present are included, so the app
 * always has at least the mock as a working final fallback — the
 * platform runs with zero paid API keys configured.
 */
function instantiateProvider(id: ProviderId): AiProvider {
  switch (id) {
    case "gemini":
      return new GeminiProvider(
        process.env.GEMINI_API_KEY!.trim(),
        process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"
      );
    case "cloudflare":
      return new CloudflareAiProvider(
        process.env.CLOUDFLARE_ACCOUNT_ID!.trim(),
        process.env.CLOUDFLARE_AI_API_TOKEN!.trim()
      );
    case "openrouter":
      return new OpenRouterProvider(
        process.env.OPENROUTER_API_KEY!.trim(),
        process.env.OPENROUTER_MODEL?.trim() || "meta-llama/llama-3.1-8b-instruct:free"
      );
    case "mock":
      return mock;
  }
}

function buildProviderChain(): AiProvider[] {
  return selectProviderOrder(process.env as AiEnv).map(instantiateProvider);
}

export function isDevelopmentAiMode(): boolean {
  return isDevOnlyChain(selectProviderOrder(process.env as AiEnv));
}

/**
 * Configuration status per provider — booleans only, never the key
 * values themselves. Used by the Super Admin AI settings page so
 * operators can see what's wired up without exposing secrets (see
 * "no exposure of provider API keys" in docs/AI-SAFETY.md).
 */
export function getProviderConfigStatus(): { id: ProviderId; configured: boolean; priority: number }[] {
  return [
    { id: "gemini", configured: Boolean(process.env.GEMINI_API_KEY?.trim()), priority: 1 },
    {
      id: "cloudflare",
      configured: Boolean(
        process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_AI_API_TOKEN?.trim()
      ),
      priority: 2,
    },
    { id: "openrouter", configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()), priority: 3 },
    { id: "mock", configured: true, priority: 4 },
  ];
}

export type GatewayLogContext = {
  schoolId: string | null;
  actorId: string | null;
  locale: "kk" | "ru" | "en";
};

async function logCall(
  capability: AiCapability,
  provider: ProviderId,
  isMock: boolean,
  latencyMs: number,
  safetyFlags: string[],
  ctx?: GatewayLogContext
) {
  try {
    await withSystemContext(
      (sql) => sql`
        insert into ai_logs (school_id, actor_id, capability, provider, is_mock, locale, latency_ms, safety_flags)
        values (${ctx?.schoolId ?? null}, ${ctx?.actorId ?? null}, ${capability}, ${provider}, ${isMock}, ${ctx?.locale ?? "kk"}, ${latencyMs}, ${JSON.stringify(safetyFlags)})
      `
    );
  } catch (err) {
    // Logging must never break the user-facing AI feature.
    console.error("Failed to write AI log", err);
  }
}

async function runWithFallback<T>(
  capability: AiCapability,
  ctx: GatewayLogContext | undefined,
  fn: (provider: AiProvider) => Promise<T>
): Promise<{ result: T; provider: ProviderId; isMock: boolean }> {
  const chain = buildProviderChain();
  let lastError: unknown;

  for (const provider of chain) {
    const start = Date.now();
    try {
      const result = await fn(provider);
      await logCall(capability, provider.id, provider.isMock, Date.now() - start, [], ctx);
      return { result, provider: provider.id, isMock: provider.isMock };
    } catch (err) {
      lastError = err;
      console.warn(`[ai-gateway] ${provider.id} failed for ${capability}, falling back`, err);
    }
  }

  // The mock is always last in the chain and never throws, so reaching
  // here means every candidate (including mock) failed unexpectedly.
  throw lastError instanceof Error ? lastError : new Error("All AI providers failed");
}

export async function chatWithEcoAI(
  input: ChatInput,
  ctx?: GatewayLogContext
): Promise<ChatOutput & { provider: ProviderId; isMock: boolean }> {
  const { result, provider, isMock } = await runWithFallback("nature_chat", ctx, (p) => p.chat(input));
  const safe = input.audience === "child" ? enforceChatSafety(result, input.locale) : result;
  return { ...safe, provider, isMock };
}

export async function recognizeNatureImage(
  input: RecognitionInput,
  ctx?: GatewayLogContext
): Promise<RecognitionOutput & { provider: ProviderId; isMock: boolean }> {
  const { result, provider, isMock } = await runWithFallback("plant_recognition", ctx, (p) =>
    p.recognizeImage(input)
  );
  const safe = enforceRecognitionSafety(result, input.locale);
  return { ...safe, provider, isMock };
}

export async function generateLessonBundle(
  input: StructuredInput,
  ctx?: GatewayLogContext
): Promise<LessonBundle & { provider: ProviderId; isMock: boolean }> {
  const { result, provider, isMock } = await runWithFallback("lesson_generate", ctx, (p) =>
    p.generateLesson(input)
  );
  return { ...result, provider, isMock };
}

export async function generateEcoStory(
  input: StructuredInput,
  ctx?: GatewayLogContext
): Promise<StoryOutput & { provider: ProviderId; isMock: boolean }> {
  const { result, provider, isMock } = await runWithFallback("story_generate", ctx, (p) =>
    p.generateStory(input)
  );
  return { ...result, provider, isMock };
}

export async function generateEcoStoryboard(
  input: StructuredInput,
  ctx?: GatewayLogContext
): Promise<StoryboardOutput & { provider: ProviderId; isMock: boolean }> {
  const { result, provider, isMock } = await runWithFallback("storyboard_generate", ctx, (p) =>
    p.generateStoryboard(input)
  );
  return { ...result, provider, isMock };
}
