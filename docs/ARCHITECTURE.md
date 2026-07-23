# Architecture

This document describes what was actually built, why, and where it
deliberately deviates from [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md)
(the pre-development blueprint approved before implementation began).
Read that document for the original product vision, information
architecture, and long-term roadmap; read this one for how the MVP
phase is actually wired together.

## Database access: plain PostgreSQL, no ORM — the chosen approach

The build instructions required picking **one** clear source of truth
for database access, from two acceptable options: "Supabase Postgres
client with Row Level Security" or "Prisma only in a Node.js runtime."

**Chosen: direct PostgreSQL access via [`postgres.js`](https://github.com/porsager/postgres), with Row Level Security as a second, independently-enforced authorization layer.**

Why not Prisma: Prisma's query engine is a native binary that does not
run in Cloudflare's Workers runtime without extra adapters and
constraints, and the brief explicitly warned against forcing Prisma
into an incompatible edge runtime. Rather than carrying that
constraint through the whole codebase, plain SQL migrations +
`postgres.js` (a pure-JS/TS driver) avoid the problem entirely and work
identically against local Docker Postgres and hosted Supabase Postgres
— they're the same database engine either way.

Why not Supabase's client SDK specifically: `@supabase/supabase-js`'s
data access goes through PostgREST and Supabase Auth's `auth.jwt()`,
neither of which exists on a plain local Postgres container. Using
`postgres.js` directly against a real Postgres connection string works
the same way locally and in production, and RLS policies can reference
our own session-scoped settings instead of Supabase-specific SQL
functions (see below) — so the app is portable to *any* Postgres host,
Supabase included, without code changes.

### Two database roles, on purpose

- **`ecostart`** (the Docker bootstrap superuser) — used **only** by
  `scripts/migrate.ts` and `scripts/seed.ts`. It owns the schema.
- **`app_user`** (created in `0003_app_role_and_extra_policies.sql`) —
  a role with no special privileges, used by the running Next.js app
  for every request. Because it's not a superuser, Postgres actually
  enforces Row Level Security for it — a superuser silently bypasses
  RLS, which would make the policies decorative.

This is why `.env.example` defines two connection strings
(`DATABASE_URL` for scripts, `APP_DATABASE_URL` for the app) instead of
one.

### Row Level Security without Supabase Auth

Supabase's own RLS examples key policies off `auth.jwt()`, a function
that only exists once Supabase's Auth/GoTrue schema is installed —
which local Docker Postgres doesn't have. Instead, `src/db/client.ts`'s
`withTenantContext()` sets three Postgres session-local settings at the
start of every transaction:

```sql
select set_config('app.current_user_id', $1, true);
select set_config('app.current_school_id', $2, true);
select set_config('app.current_role', $3, true);
```

`0002_rls.sql` and `0003_app_role_and_extra_policies.sql` define
policies against `app_current_user_id()` / `app_current_school_id()` /
`app_current_role()` (thin SQL wrappers around `current_setting`).
This pattern is portable — it works unmodified against a hosted
Supabase Postgres instance too.

**This is defense in depth, not the only check.** The primary
authorization boundary is the application-layer Data Access Layer
(`src/lib/auth/dal.ts`) — `requireRole()` is called at the top of every
protected server component, server action, and route handler, before
any query runs. RLS is what stops a bug in that application-layer
check from becoming a cross-tenant data leak, not a replacement for it.
One legitimate carve-out: **login itself** can't have a tenant context
yet (no session exists), so `auth_lookup_credentials()` and
`auth_record_login()` are narrow `SECURITY DEFINER` SQL functions
(`0004_auth_functions.sql`) that `app_user` may execute but that don't
otherwise expose the `users` table.

### Migrations

Plain, numbered `.sql` files in `src/db/migrations/`, applied in order
by `scripts/migrate.ts`, tracked in a `_migrations` table. No
migration-generation tooling, no shadow database — what's in the
folder is what the schema is.

## AI provider abstraction

`src/lib/ai/gateway.ts` is the single entry point every feature
(EcoLab recognition, Nature Chat, AI Studio lesson generation, EcoMedia
story/storyboard) calls through — never a provider SDK directly.

**Provider priority** (`src/lib/ai/provider-selection.ts`, a
dependency-free pure function so it's unit-testable without booting a
database or Next.js): **Gemini → Cloudflare Workers AI → OpenRouter →
deterministic mock.** Only providers with their required environment
variables present are included; the mock is always appended last and
never throws, so the chain always has a working final entry — this is
what makes "the application must run without paid API keys" true by
construction, not by a special-cased dev flag.

**Fallback on failure, not just on missing config**: `gateway.ts`'s
`runWithFallback()` tries each provider in the chain in order and only
advances to the next on a thrown error (network failure, bad response
shape, non-2xx status), logging a warning each time. A transient Gemini
outage degrades to Cloudflare, then OpenRouter, then the mock — it
never surfaces a 500 to the user as long as any provider (even just the
mock) is reachable.

**Safety filtering happens after every provider, mock included**
(`src/lib/ai/safety.ts`) — see [`AI-SAFETY.md`](AI-SAFETY.md) for the
full contract. This is deliberate: prompt engineering
(`src/lib/ai/prompts.ts`) is the first line of defense but is not
trusted on its own, because a model can ignore its system prompt. The
safety layer runs unconditionally in code afterward.

**Every AI call is logged** to the `ai_logs` table (provider, capability,
locale, latency, `is_mock`, no raw PII) — this is what powers the Super
Admin "AI usage by provider" view and gives an audit trail for content
review.

### Real provider implementations

All three real providers (`src/lib/ai/providers/{gemini,cloudflare,openrouter}.ts`)
are genuine, complete HTTP integrations against each vendor's actual
API shape (Gemini's `generateContent`, Cloudflare Workers AI's `/ai/run/<model>`,
OpenRouter's OpenAI-compatible `/chat/completions`) — not stubs. They
are **not exercised by this environment's automated tests**, since no
paid keys were configured here; correctness for those three providers
rests on API-shape review, not a live call. See "Known limitations"
below and `docs/DEPLOYMENT.md` for how to enable and smoke-test them
with real keys.

## Storage: local disk vs. Cloudflare R2

`src/lib/storage/index.ts` picks an adapter at first use based on
`STORAGE_DRIVER` and whether R2 credentials are present; it defaults to
writing under `public/uploads/` (served by Next.js directly, zero
extra routing) when they're not. The R2 adapter uses the AWS S3 SDK
pointed at R2's S3-compatible endpoint — R2 is deliberately
S3-API-compatible, so no bespoke client was needed.

Every upload path validates file type and size server-side
(`src/lib/storage/types.ts`'s `validateImageUpload`) before it ever
reaches a storage adapter or the AI gateway.

## Certificate PDFs and the Node.js runtime

`GET /api/certificates/[id]` renders a certificate as a PDF with
`@react-pdf/renderer`, which needs Node's `fs`/`Buffer` APIs and is
therefore marked `export const runtime = "nodejs"`. This is the one
route in the app that cannot run on a pure edge/Workers runtime as-is.

Kazakh/Russian certificate text is Cyrillic; the PDF standard-14 fonts
(Helvetica etc.) only cover Latin, so `src/lib/pdf/certificate.tsx`
embeds a bundled Cyrillic-capable font (`src/lib/pdf/fonts/NotoSans-*.ttf`)
rather than fetching one at render time — no network dependency, no
risk of blank glyphs.

**Deployment implication** (see `docs/DEPLOYMENT.md`): if the rest of
the app deploys to Cloudflare Pages/Workers, this one route needs a
Node-compatible target (Cloudflare's Node.js compatibility mode, or a
small dedicated Node service/Vercel function for just this endpoint).
It is isolated on purpose so that constraint doesn't spread anywhere
else.

## Internationalization

`next-intl`, `{locale}` as the first URL segment (`localePrefix:
"always"`), `kk` default, `ru`/`en` full peers. `src/proxy.ts` runs
`next-intl`'s middleware first for locale resolution, then layers
optimistic auth redirects on top — see below.

AI-generated content is produced **directly** in the target locale via
locale-aware prompt templates (`src/lib/ai/prompts.ts`), never
generated once and translated, matching the blueprint's original
i18n-architecture intent.

## Authorization: two layers, one source of truth

1. **`src/proxy.ts`** (Next.js 16 renamed Middleware → Proxy) —
   optimistic, cookie-only redirects for UX (unauthenticated → `/login`,
   authenticated-on-`/login` → their dashboard). Fast, but it only
   decrypts the session JWT; it never touches the database.
2. **`src/lib/auth/dal.ts`**'s `requireRole(...)` — the actual boundary.
   Every protected server component, server action, and route handler
   calls this first. It redirects unauthenticated sessions and
   wrong-role sessions to their own dashboard (never a raw 404/500),
   and every downstream query additionally goes through
   `withTenantContext()`, so RLS backs it up independently.

Neither layer is "the UI hides the button" — every mutating action
(server actions in `src/app/[locale]/app/**/actions.ts`) re-checks the
role itself; a hidden button is not a security boundary anywhere in
this app.

## Deviations from the blueprint

| Blueprint | What was actually built | Why |
|---|---|---|
| Separate `User` and `Child` tables | One `users` table; `role = 'CHILD'` rows carry `xp`/`level`/`login_code`/`pin_hash`, other roles carry `email`/`password_hash` | One identity table means one session/auth mechanism for every role instead of two, with a single `CHECK` constraint enforcing the email-vs-login-code shape per role. Simpler without losing anything the MVP needs. |
| Prisma ORM | Plain SQL migrations + `postgres.js` | See "Database access" above — avoids the Cloudflare Workers/Prisma runtime conflict the build instructions flagged. |
| Supabase Auth in production | Custom credentials (bcrypt + JWT session cookie, `jose`) everywhere, designed to be swappable | Runs identically with zero external accounts locally; Supabase Auth can be layered in later by swapping `src/lib/auth/credentials.ts` without touching the RLS design, since the session-GUC pattern doesn't depend on it. |
| Turborepo monorepo (`apps/`, `packages/`) | Single Next.js app, feature-organized under `src/` | The blueprint's monorepo split was justified by "web now, mobile later." No mobile app exists yet in this phase — introducing package boundaries before there's a second consumer would be premature structure with no current payer. |
| 8 generated lesson artifact types (lesson plan, presentation, quiz, worksheet, coloring page, story, certificate template, homework, observation sheet) | Teacher AI Studio generates 3: lesson plan, quiz, homework tip | Scoped explicitly by the build instructions for this phase ("Teacher dashboard: ... AI lesson generator"). The `lesson_artifacts.type` enum still has all 8 values, so extending generation to the rest is additive, not a schema change. |
| Full AI video rendering in EcoMedia Studio | Story generation, storyboard generation, media upload — no video rendering | Explicitly out of scope per the build instructions ("do not attempt expensive full AI video rendering"). |
| Submissions/homework-turn-in flow | `lesson_assignments` (teacher → group) exists and is shown to parents/teachers; there's no child-facing "submit homework" UI | Not in the enumerated functional requirements for this phase; the `submissions` table from the blueprint's schema was cut when it turned out nothing in this phase's scope wrote to it — see the audit-log-worthy incident below. |

*(A first pass of `scripts/seed.ts` reset logic referenced a
`submissions` table that was never actually created — caught by the
teacher-dashboard end-to-end test, not left in. Fixed by removing the
stale reference rather than adding a table nothing else uses yet.)*

## Known limitations

Documented honestly rather than silently shipped:

- **Local Postgres runs on host port 5434, not 5432**
  (`docker-compose.yml`, `.env.example`). On the reference dev machine,
  5432 is already bound by an unrelated project's Postgres container.
  Connecting to "port 5432" in that situation doesn't fail with a
  connection error — it silently succeeds against the *other* instance,
  which has no `app_user` role, surfacing as
  `password authentication failed for user "app_user"` instead of an
  obviously-network-related error. Confirmed via `docker ps` plus a
  direct connection probe run from the host with the exact credentials
  `src/db/client.ts` uses. 5434 avoids the collision; see
  `README.md`'s Troubleshooting section if 5434 is also taken.
- **Rate limiting is in-memory and single-instance-only**
  (`src/lib/rate-limit.ts`). Correct for one dev/demo instance; a
  multi-instance production deployment needs a shared store (Cloudflare
  Rate Limiting rules, or Upstash/Redis).
- **Real AI providers (Gemini/Cloudflare/OpenRouter) are implemented
  but untested against live APIs** in this environment — no paid keys
  were available to this build. The mock provider is exercised
  end-to-end by every automated test; the real adapters are reviewed
  for API-shape correctness but not live-called. See
  `docs/DEPLOYMENT.md` for how to add keys and smoke-test each one.
- **No native mobile app, AR/VR, or IoT sensor ingestion** — explicitly
  phased for later in the blueprint (§15); the schema already has the
  hooks (`SensorReading.source: manual | iot_device`, an API-first
  route design) but no client consumes them yet.
- **No child-facing homework submission flow** — teachers can assign
  lessons to a group and parents/teachers can see the assignment, but
  there's no "child turns in homework" UI in this phase.
- **Single-school demo data model exercised** — multi-school
  Row-Level-Security isolation is implemented and covered by the RLS
  policies/tests, but only one school's worth of seed data exists to
  click through in the demo.
- **Content moderation is a manual visibility toggle**, not an
  automated review queue — admins can set any media asset's visibility
  (`private`/`shared_family`/`shared_school`); there's no AI-assisted
  or workflow-based moderation queue yet.
