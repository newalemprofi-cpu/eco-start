import {
  chatSystemPrompt,
  lessonPrompt,
  recognitionSystemPrompt,
  storyboardPrompt,
  storyPrompt,
} from "@/lib/ai/prompts";
import {
  extractJson,
  LessonSchema,
  RecognitionSchema,
  StoryboardSchema,
  StorySchema,
} from "@/lib/ai/schemas";
import type {
  AiProvider,
  ChatInput,
  ChatOutput,
  LessonBundle,
  RecognitionInput,
  RecognitionOutput,
  StoryboardOutput,
  StructuredInput,
  StoryOutput,
} from "@/lib/ai/types";
import { AiProviderError } from "@/lib/ai/types";

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

type CfMessage = { role: "system" | "user" | "assistant"; content: string };

export class CloudflareAiProvider implements AiProvider {
  readonly id = "cloudflare" as const;
  readonly isMock = false;

  constructor(
    private readonly accountId: string,
    private readonly apiToken: string
  ) {}

  private endpoint(model: string) {
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`;
  }

  private async runText(messages: CfMessage[]): Promise<string> {
    const res = await fetch(this.endpoint(TEXT_MODEL), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ messages, temperature: 0.6 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiProviderError(
        "cloudflare",
        `Workers AI error ${res.status}: ${body.slice(0, 300)}`
      );
    }
    const json = (await res.json()) as { result?: { response?: string }; success?: boolean };
    if (!json.success || !json.result?.response) {
      throw new AiProviderError("cloudflare", "Workers AI returned no response");
    }
    return json.result.response;
  }

  private async runVision(prompt: string, imageBase64: string): Promise<string> {
    const bytes = Array.from(Buffer.from(imageBase64, "base64"));
    const res = await fetch(this.endpoint(VISION_MODEL), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ image: bytes, prompt, max_tokens: 512 }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiProviderError(
        "cloudflare",
        `Workers AI vision error ${res.status}: ${body.slice(0, 300)}`
      );
    }
    const json = (await res.json()) as { result?: { description?: string }; success?: boolean };
    if (!json.success || !json.result?.description) {
      throw new AiProviderError("cloudflare", "Workers AI vision returned no response");
    }
    return json.result.description;
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    const messages: CfMessage[] = [
      { role: "system", content: chatSystemPrompt(input.locale, input.audience) },
      ...input.history.slice(-8).map((t) => ({ role: t.role, content: t.content }) as CfMessage),
      { role: "user", content: input.message },
    ];
    const text = await this.runText(messages);
    return { reply: text.trim() };
  }

  async recognizeImage(input: RecognitionInput): Promise<RecognitionOutput> {
    const prompt = `${recognitionSystemPrompt(input.locale)}\n\nDescribe exactly what is in the image so it can be classified.`;
    const description = await this.runVision(prompt, input.imageBase64);
    // Llava-style models answer in prose, not guaranteed JSON — run the
    // description back through the text model to force the JSON contract.
    const jsonText = await this.runText([
      { role: "system", content: recognitionSystemPrompt(input.locale) },
      { role: "user", content: `Image description: ${description}` },
    ]);
    return RecognitionSchema.parse(extractJson(jsonText));
  }

  async generateLesson(input: StructuredInput): Promise<LessonBundle> {
    const text = await this.runText([
      { role: "system", content: lessonPrompt(input.locale, input.topic, input.ageBand ?? "5-6") },
      { role: "user", content: "Generate the lesson now." },
    ]);
    return LessonSchema.parse(extractJson(text));
  }

  async generateStory(input: StructuredInput): Promise<StoryOutput> {
    const text = await this.runText([
      { role: "system", content: storyPrompt(input.locale, input.topic) },
      { role: "user", content: "Write the story now." },
    ]);
    return StorySchema.parse(extractJson(text));
  }

  async generateStoryboard(input: StructuredInput): Promise<StoryboardOutput> {
    const text = await this.runText([
      { role: "system", content: storyboardPrompt(input.locale, input.storyText ?? input.topic) },
      { role: "user", content: "Generate the storyboard now." },
    ]);
    return StoryboardSchema.parse(extractJson(text));
  }
}
