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

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

async function callGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  contents: GeminiContent[]
): Promise<string> {
  const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiProviderError("gemini", `Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new AiProviderError("gemini", "Gemini returned no text");
  return text;
}

export class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    const system = chatSystemPrompt(input.locale, input.audience);
    const contents: GeminiContent[] = [
      ...input.history.slice(-8).map((t) => ({
        role: (t.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: t.content }],
      })),
      { role: "user", parts: [{ text: input.message }] },
    ];
    const text = await callGemini(this.apiKey, this.model, system, contents);
    return { reply: text.trim() };
  }

  async recognizeImage(input: RecognitionInput): Promise<RecognitionOutput> {
    const system = recognitionSystemPrompt(input.locale);
    const contents: GeminiContent[] = [
      {
        role: "user",
        parts: [
          { text: "Identify what is shown in this image." },
          { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
        ],
      },
    ];
    const text = await callGemini(this.apiKey, this.model, system, contents);
    const parsed = RecognitionSchema.parse(extractJson(text));
    return parsed;
  }

  async generateLesson(input: StructuredInput): Promise<LessonBundle> {
    const prompt = lessonPrompt(input.locale, input.topic, input.ageBand ?? "5-6");
    const text = await callGemini(this.apiKey, this.model, prompt, [
      { role: "user", parts: [{ text: "Generate the lesson now." }] },
    ]);
    return LessonSchema.parse(extractJson(text));
  }

  async generateStory(input: StructuredInput): Promise<StoryOutput> {
    const prompt = storyPrompt(input.locale, input.topic);
    const text = await callGemini(this.apiKey, this.model, prompt, [
      { role: "user", parts: [{ text: "Write the story now." }] },
    ]);
    return StorySchema.parse(extractJson(text));
  }

  async generateStoryboard(input: StructuredInput): Promise<StoryboardOutput> {
    const prompt = storyboardPrompt(input.locale, input.storyText ?? input.topic);
    const text = await callGemini(this.apiKey, this.model, prompt, [
      { role: "user", parts: [{ text: "Generate the storyboard now." }] },
    ]);
    return StoryboardSchema.parse(extractJson(text));
  }
}
