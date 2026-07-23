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

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

type OrTextContent = { type: "text"; text: string };
type OrImageContent = { type: "image_url"; image_url: { url: string } };
type OrMessage = {
  role: "system" | "user" | "assistant";
  content: string | (OrTextContent | OrImageContent)[];
};

export class OpenRouterProvider implements AiProvider {
  readonly id = "openrouter" as const;
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  private async run(messages: OrMessage[]): Promise<string> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Eco Start AI",
      },
      body: JSON.stringify({ model: this.model, messages, temperature: 0.6 }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiProviderError(
        "openrouter",
        `OpenRouter error ${res.status}: ${body.slice(0, 300)}`
      );
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new AiProviderError("openrouter", "OpenRouter returned no content");
    return text;
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    const messages: OrMessage[] = [
      { role: "system", content: chatSystemPrompt(input.locale, input.audience) },
      ...input.history.slice(-8).map((t) => ({ role: t.role, content: t.content }) as OrMessage),
      { role: "user", content: input.message },
    ];
    const text = await this.run(messages);
    return { reply: text.trim() };
  }

  async recognizeImage(input: RecognitionInput): Promise<RecognitionOutput> {
    const messages: OrMessage[] = [
      { role: "system", content: recognitionSystemPrompt(input.locale) },
      {
        role: "user",
        content: [
          { type: "text", text: "Identify what is in this image." },
          {
            type: "image_url",
            image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` },
          },
        ],
      },
    ];
    const text = await this.run(messages);
    return RecognitionSchema.parse(extractJson(text));
  }

  async generateLesson(input: StructuredInput): Promise<LessonBundle> {
    const text = await this.run([
      { role: "system", content: lessonPrompt(input.locale, input.topic, input.ageBand ?? "5-6") },
      { role: "user", content: "Generate the lesson now." },
    ]);
    return LessonSchema.parse(extractJson(text));
  }

  async generateStory(input: StructuredInput): Promise<StoryOutput> {
    const text = await this.run([
      { role: "system", content: storyPrompt(input.locale, input.topic) },
      { role: "user", content: "Write the story now." },
    ]);
    return StorySchema.parse(extractJson(text));
  }

  async generateStoryboard(input: StructuredInput): Promise<StoryboardOutput> {
    const text = await this.run([
      { role: "system", content: storyboardPrompt(input.locale, input.storyText ?? input.topic) },
      { role: "user", content: "Generate the storyboard now." },
    ]);
    return StoryboardSchema.parse(extractJson(text));
  }
}
