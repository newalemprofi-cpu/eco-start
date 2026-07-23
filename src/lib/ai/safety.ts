import type { AiLocale, ChatOutput, RecognitionOutput } from "@/lib/ai/types";

/**
 * Code-level safety enforcement for anything that reaches a child
 * surface. This layer runs AFTER every provider call (mock or real) and
 * cannot be bypassed by a model ignoring its system prompt — see
 * docs/AI-SAFETY.md. Prompt engineering (src/lib/ai/prompts.ts) is the
 * first line of defense; this is the second, unconditional one.
 */

const LOW_CONFIDENCE_THRESHOLD = 0.65;

// Heuristic keyword filter. Deliberately simple and documented as such
// in docs/AI-SAFETY.md — a production deployment should layer a real
// moderation model (e.g. a dedicated safety-classification call) on top.
const UNSAFE_PATTERNS: RegExp[] = [
  /\b(safe to (eat|touch|taste))\b/i,
  /\b(you can eat|you may eat|it is edible)\b/i,
  /можно (есть|кушать|трогать|съесть)/i,
  /безопасно (есть|трогать|кушать)/i,
  /жеуге болады|ұстауға болады|жеуге қауіпсіз/i,
  /\b(kill|weapon|self.?harm|suicide)\b/i,
  /(оружие|самоубийств|навреди себе)/i,
  /(қару|өз-өзіне зиян)/i,
];

const CAUTION_NOTE: Record<AiLocale, string> = {
  kk: " ⚠️ Мен нақты білмеймін, сондықтан оны дәмдеп көрме немесе ұстама — тәрбиешіңнен немесе ата-анаңнан сұра.",
  ru: " ⚠️ Я не знаю точно, поэтому не пробуй и не трогай это — спроси учителя или родителей.",
  en: " ⚠️ I'm not certain, so please don't taste or touch it — ask a teacher or parent first.",
};

const LOW_CONFIDENCE_PREFIX: Record<AiLocale, string> = {
  kk: "Мен толық сенімді емеспін, бірақ бұл ",
  ru: "Я не совсем уверен, но это похоже на ",
  en: "I'm not fully sure, but this looks like ",
};

const ASK_TEACHER_SUFFIX: Record<AiLocale, string> = {
  kk: " Дәлірек білу үшін тәрбиешіңнен сұра!",
  ru: " Чтобы узнать точнее, спроси своего учителя!",
  en: " Ask your teacher to be sure!",
};

export function sanitizeText(text: string, locale: AiLocale): string {
  let out = text;
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, "").trim();
      out += CAUTION_NOTE[locale];
    }
  }
  return out;
}

export function enforceChatSafety(output: ChatOutput, locale: AiLocale): ChatOutput {
  return { reply: sanitizeText(output.reply, locale) };
}

/**
 * The hard guarantee from the spec: "never state that a plant is safe
 * to eat or touch based only on AI recognition." This does not just
 * filter language — it structurally rewrites low-confidence or
 * toxicity-flagged results so the UI cannot render a bare "safe" claim.
 */
export function enforceRecognitionSafety(
  output: RecognitionOutput,
  locale: AiLocale
): RecognitionOutput {
  let funFact = sanitizeText(output.funFact, locale);
  const lowConfidence = output.confidence < LOW_CONFIDENCE_THRESHOLD;

  if (lowConfidence) {
    funFact = `${LOW_CONFIDENCE_PREFIX[locale]}${output.label}. ${funFact}`;
  }

  if (output.isPotentiallyToxic || lowConfidence) {
    funFact = `${funFact}${CAUTION_NOTE[locale]}`;
  }

  funFact = `${funFact}${ASK_TEACHER_SUFFIX[locale]}`;

  return {
    ...output,
    // Safety-first: any uncertainty flips this to true. The UI treats
    // this field, not the raw model output, as the source of truth.
    isPotentiallyToxic: output.isPotentiallyToxic || lowConfidence,
    funFact,
  };
}
