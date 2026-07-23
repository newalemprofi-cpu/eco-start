# AI Safety

This app puts AI output in front of children aged 5–7. This document
is the contract for what that output is allowed to say, and — more
importantly — **where each rule is enforced in code**, because a
prompt instruction alone is not a guarantee.

## The required guarantees, and where they live

| Requirement | Enforced by | Bypassable by a model ignoring its prompt? |
|---|---|---|
| Simple Kazakh (or Russian/English) for children | System prompt (`src/lib/ai/prompts.ts` → `chatSystemPrompt`, audience-aware) | Yes — this one is prompt-only, see "What is and isn't code-enforced" below |
| Age-appropriate for 5–7 | System prompt, plus keyword filtering for unsafe content | Partially |
| Avoid unsafe instructions | Keyword filter (`src/lib/ai/safety.ts` → `sanitizeText`, `UNSAFE_PATTERNS`) | No — code-level, runs on every output |
| Never present plant ID as certain | **Structural rewrite**, not just wording (`enforceRecognitionSafety`) | No |
| Low-confidence warning | Code-level: confidence `< 0.65` forces a "not fully sure" prefix, regardless of what the model said | No |
| Recommend checking with a teacher | Code-level: appended to every child-facing recognition and chat reply, unconditionally | No |
| Never state a plant is safe to eat/touch based only on AI recognition | **Two independent code-level mechanisms** — see below | No |

### The core guarantee, in detail

`src/lib/ai/safety.ts` → `enforceRecognitionSafety()` runs on the
output of **every** provider (Gemini, Cloudflare, OpenRouter, or the
mock) before it reaches a response:

```ts
// Safety-first: any uncertainty flips this to true. The UI treats
// this field, not the raw model output, as the source of truth.
isPotentiallyToxic: output.isPotentiallyToxic || lowConfidence,
```

This means:

1. If the model says `isPotentiallyToxic: false` but confidence is
   below the threshold, the app overrides it to `true` anyway. A model
   cannot produce a "definitely safe" result by simply being
   unconfident about a genuinely dangerous species.
2. `sanitizeText()` additionally regex-matches phrases like *"safe to
   eat"*, *"жеуге болады"*, *"можно есть"* (English, Kazakh, Russian)
   in the free-text fun-fact and **strips them**, replacing them with
   an explicit caution note in the response locale. This catches the
   case where a model states a safety claim in prose that the
   structured `isPotentiallyToxic` field didn't capture.
3. The child-facing UI (`src/components/child/ecolab-uploader.tsx`)
   renders a warning card whenever `isPotentiallyToxic` is true — it
   never renders a bare species name with no caveat when that flag is
   set.

The result: **no code path in this app can render an unqualified "this
is safe to eat/touch" claim**, regardless of what any provider (real or
mock) returns.

### What is and isn't code-enforced

Being direct about the boundary: **tone, simplicity of language, and
overall age-appropriateness are prompt-engineered, not code-enforced.**
`src/lib/ai/prompts.ts` instructs every child-facing capability to use
short sentences and simple vocabulary, and a well-behaved model
follows that closely. But nothing in `safety.ts` re-validates sentence
length or vocabulary complexity — a provider that ignored its system
prompt could return an overly complex response and it would still pass
through. This is a known, documented gap (see "Recommended hardening"
below), not a silent one.

What **is** unconditionally code-enforced regardless of prompt
adherence: the toxicity/safety-claim guarantee above, low-confidence
handling, the "ask a teacher" recommendation, and the basic unsafe-content
keyword filter.

## The keyword filter is a heuristic, not a moderation model

`UNSAFE_PATTERNS` in `src/lib/ai/safety.ts` is a small, explicit
regex list (safety claims about eating/touching; violence/self-harm
terms in three languages). It is intentionally simple and will not
catch every unsafe phrasing a model could produce. **A production
deployment should layer a real moderation classifier** (a dedicated
safety-scoring model call, or a third-party moderation API) on top of
this — this MVP's filter is the floor, not the ceiling.

## Rate limiting on AI endpoints

Every AI-backed server action (`analyzeImageAction`, chat,
`generateLessonAction`, story/storyboard generation) calls
`rateLimit()` (`src/lib/rate-limit.ts`) before touching the gateway,
keyed per-user:

- Chat: `AI_CHAT_RATE_LIMIT_PER_MINUTE` (default 8/minute)
- Generation (recognition, lessons, stories, storyboards):
  `AI_GENERATION_RATE_LIMIT_PER_HOUR` (default 30/hour)

This limits both cost exposure and how much AI-generated content a
single child/teacher session can produce in a burst. See
`docs/ARCHITECTURE.md` "Known limitations" — this limiter is
in-memory and per-instance, not yet distributed.

## Provider fallback and the mock provider's role in safety

Every real provider can fail (network error, quota, malformed
response) — `src/lib/ai/gateway.ts`'s fallback chain means a Gemini
outage degrades to Cloudflare, then OpenRouter, then the deterministic
mock, rather than surfacing an error to a child. **The safety layer
runs identically regardless of which provider actually answered** —
`enforceRecognitionSafety`/`enforceChatSafety` don't know or care
whether the input came from Gemini or the mock. This is why the mock
provider is deterministic (`src/lib/ai/hash.ts`'s seeded picks, not
`Math.random()`): it lets the exact same safety-path behavior — low
confidence, toxicity flags, caution notes — be exercised and asserted
in automated tests (`src/lib/ai/safety.test.ts`,
`e2e/ecolab.spec.ts`) without needing a live model call.

## Audit trail

Every AI call (any provider, including the mock) is logged to
`ai_logs`: capability, provider, `is_mock`, locale, latency, and a
`safety_flags` column reserved for future use. No raw child PII is
logged — see `docs/ARCHITECTURE.md`'s RLS section for how that table
is tenant-isolated.

## Recommended hardening before a real production launch

Documented as a roadmap, not implemented in this MVP phase:

1. A dedicated content-moderation model call (not just keyword
   matching) in the safety pipeline.
2. Server-side response-length/complexity checks tuned to a 5–7-year
   reading level, to catch a model ignoring the "simple language"
   system prompt.
3. A human-reviewable log of flagged/sanitized outputs (the
   `ai_logs.safety_flags` column exists; nothing populates it yet).
4. Move rate limiting to a shared store for multi-instance deployments.
