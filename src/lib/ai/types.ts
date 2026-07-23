export type AiLocale = "kk" | "ru" | "en";
export type AiAudience = "child" | "teacher";
export type ProviderId = "gemini" | "cloudflare" | "openrouter" | "mock";

export type AiCapability =
  | "nature_chat"
  | "plant_recognition"
  | "lesson_generate"
  | "story_generate"
  | "storyboard_generate";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatInput = {
  locale: AiLocale;
  audience: AiAudience;
  history: ChatTurn[];
  message: string;
};

export type ChatOutput = {
  reply: string;
};

export type RecognitionInput = {
  locale: AiLocale;
  imageBase64: string;
  mimeType: string;
  kindHint?: "PLANT" | "ANIMAL" | "LEAF" | "OBJECT";
};

export type RecognitionOutput = {
  label: string;
  kind: "PLANT" | "ANIMAL" | "LEAF" | "OBJECT";
  confidence: number; // 0..1
  funFact: string;
  isPotentiallyToxic: boolean;
};

export type LessonBundle = {
  title: string;
  ageBand: string;
  objective: string;
  plan: string[];
  quiz: { question: string; options: string[]; correctIndex: number }[];
  homeworkTip: string;
};

export type StoryOutput = {
  title: string;
  paragraphs: string[];
};

export type StoryboardScene = {
  scene: number;
  description: string;
  narration: string;
};

export type StoryboardOutput = {
  title: string;
  scenes: StoryboardScene[];
};

export type StructuredCapability =
  | { capability: "lesson_generate"; result: LessonBundle }
  | { capability: "story_generate"; result: StoryOutput }
  | { capability: "storyboard_generate"; result: StoryboardOutput };

export type StructuredInput = {
  locale: AiLocale;
  topic: string;
  ageBand?: string;
  storyText?: string; // input for storyboard_generate
};

export interface AiProvider {
  readonly id: ProviderId;
  readonly isMock: boolean;
  chat(input: ChatInput): Promise<ChatOutput>;
  recognizeImage(input: RecognitionInput): Promise<RecognitionOutput>;
  generateLesson(input: StructuredInput): Promise<LessonBundle>;
  generateStory(input: StructuredInput): Promise<StoryOutput>;
  generateStoryboard(input: StructuredInput): Promise<StoryboardOutput>;
}

export class AiProviderError extends Error {
  constructor(
    public readonly provider: ProviderId,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
