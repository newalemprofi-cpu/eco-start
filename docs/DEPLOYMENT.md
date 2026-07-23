# Deployment

This app is built local-first (see the README's quick start) and
designed to deploy to **Supabase (Postgres) + Cloudflare (hosting +
R2 storage)**, with every infrastructure choice behind an adapter so
none of it is required to develop locally. This document covers going
from the local setup to a real deployment, entirely on free tiers.

## 1. Supabase (PostgreSQL)

1. Create a project at [supabase.com](https://supabase.com) (free tier
   is enough for a pilot/demo).
2. In the Supabase dashboard, go to **Project Settings → Database** and
   copy the **connection string** (Session Pooler recommended — it's
   IPv4-compatible and works well from serverless/edge-adjacent
   runtimes). You'll get two things from Supabase: the admin
   `postgres` connection string, and your project's connection
   parameters (host, port, database).
3. Set `DATABASE_URL` in your production environment to the Supabase
   connection string, using the `postgres` role (this is only ever used
   by the one-off migrate/seed commands, run from your machine or CI —
   never by the running app).
4. Run migrations and seed **once**, against Supabase, from your local
   machine (or a CI job) — not from inside the deployed app:
   ```bash
   DATABASE_URL="<supabase-connection-string>" npm run db:migrate
   DATABASE_URL="<supabase-connection-string>" npm run db:seed   # optional — real deployments should skip or replace this
   ```
5. `0003_app_role_and_extra_policies.sql` creates an `app_user` role
   with a hardcoded local-dev password (`app_user_dev_password`) —
   **change this before a real deployment.** After running migrations
   against Supabase, connect with the Supabase SQL editor and run:
   ```sql
   alter role app_user with password '<a-real-generated-password>';
   ```
   Then set `APP_DATABASE_URL` (the connection string the *running app*
   uses) to that `app_user` connection string, not the admin one — this
   is what makes Row Level Security (see `docs/ARCHITECTURE.md`)
   actually apply in production. Never point `APP_DATABASE_URL` at the
   Supabase `postgres` superuser role.

Supabase's free tier covers this comfortably for a pilot: 500MB
database, which is far more than this schema needs for one or several
demo schools.

## 2. Cloudflare R2 (media storage)

1. In the Cloudflare dashboard, go to **R2** and create a bucket (e.g.
   `eco-start-ai-media`). R2's free tier includes 10GB storage and —
   notably — **zero egress fees**, which matters for a media-heavy app
   like this one.
2. Create an **R2 API token** (Account → R2 → Manage R2 API Tokens)
   with read/write access to that bucket. This gives you an Access Key
   ID and Secret Access Key.
3. Enable public access on the bucket (R2 → your bucket → Settings →
   Public Access) or set up a custom domain for it, and note the public
   base URL.
4. Set these in your production environment:
   ```bash
   STORAGE_DRIVER=r2
   R2_ACCOUNT_ID=<your-cloudflare-account-id>
   R2_ACCESS_KEY_ID=<from-the-api-token>
   R2_SECRET_ACCESS_KEY=<from-the-api-token>
   R2_BUCKET_NAME=eco-start-ai-media
   R2_PUBLIC_URL=<the-bucket's-public-base-url>
   ```
   With these set, `src/lib/storage/index.ts` automatically switches
   from the local-disk adapter to the R2 adapter — no code change, no
   redeploy-with-different-code needed.

## 3. AI provider keys (all optional, in priority order)

None of these are required — the app runs on the deterministic mock
provider with none of them set, and a "dev mode" badge shows in the UI
whenever it is. Add as many or as few as you want; the gateway uses
whichever ones are configured, in this order, and falls back
automatically:

1. **Gemini** (primary — best multimodal/vision support for EcoLab AI):
   get a free-tier key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
   ```bash
   GEMINI_API_KEY=<your-key>
   GEMINI_MODEL=gemini-2.0-flash   # good free-tier default
   ```
2. **Cloudflare Workers AI** (second — pairs naturally with a
   Cloudflare deployment, has a free allocation):
   ```bash
   CLOUDFLARE_ACCOUNT_ID=<your-account-id>
   CLOUDFLARE_AI_API_TOKEN=<a-token-with-Workers-AI-permission>
   ```
3. **OpenRouter** (third — model-agnostic fallback, has free-tier
   models like `meta-llama/llama-3.1-8b-instruct:free`):
   ```bash
   OPENROUTER_API_KEY=<your-key>
   OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
   ```

To force a specific provider (e.g. for testing one in isolation) set
`AI_PROVIDER_OVERRIDE` to `gemini`, `cloudflare`, `openrouter`, or
`mock`. Leave it unset for automatic priority-based selection (the
normal case).

**Smoke-testing a real provider**: log in as the demo teacher, open AI
Studio, generate a lesson, and check the "provider" badge on the
result — it names whichever provider actually answered. If a key is
misconfigured, the gateway logs a warning and falls through to the
next provider (visible in server logs), so a broken Gemini key
degrades gracefully instead of breaking the feature.

## 4. Cloudflare Pages / Workers (hosting)

The app is a standard Next.js 16 App Router project. Deploy with the
`@cloudflare/next-on-pages` (or the newer OpenNext Cloudflare adapter,
depending on what's current when you deploy) build adapter:

```bash
npm install --save-dev @cloudflare/next-on-pages
npx @cloudflare/next-on-pages
```

Then connect the repository in the Cloudflare Pages dashboard, or push
with `wrangler pages deploy`. Set every environment variable from
`.env.example` that you're using (Supabase `DATABASE_URL`/`APP_DATABASE_URL`,
`SESSION_SECRET`, R2 credentials, AI keys) as Cloudflare Pages
environment variables/secrets — **never commit real values**.

**One runtime caveat**: `src/app/api/certificates/[id]/route.ts`
(certificate PDF export) is marked `export const runtime = "nodejs"`
because `@react-pdf/renderer` needs Node's filesystem APIs. Cloudflare
Pages Functions support a Node.js compatibility mode
(`compatibility_flags = ["nodejs_compat"]` in `wrangler.toml`) that
covers this for most cases; if it doesn't in your adapter version,
route that one endpoint to a small Node-capable service (a Vercel
function, or any Node host) instead of forcing the whole app off the
edge runtime for one PDF export route. See `docs/ARCHITECTURE.md`
"Certificate PDFs and the Node.js runtime" for why this route is
isolated this way.

Required production environment variables (see `.env.example` for the
full annotated list):

```bash
DATABASE_URL              # Supabase admin connection — migrations/seed only, never set on the running app
APP_DATABASE_URL          # Supabase app_user connection — what the running app actually uses
SESSION_SECRET             # generate with: openssl rand -base64 32
NODE_ENV=production
NEXT_PUBLIC_APP_URL        # your production URL
STORAGE_DRIVER=r2
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_URL
# any subset of: GEMINI_API_KEY, CLOUDFLARE_ACCOUNT_ID+CLOUDFLARE_AI_API_TOKEN, OPENROUTER_API_KEY
```

**Do not set `DEMO_ACCOUNT_PASSWORD` or run `db:seed` against a real
production database** — the demo-accounts panel on the login page is
already gated to non-production (`NODE_ENV !== "production"`), and the
seed script deletes/recreates a full demo school on every run, which
is only appropriate for a Supabase project you're using purely as a
pilot/demo environment.

## 5. Free-tier summary

This entire stack — Supabase (Postgres), Cloudflare Pages (hosting),
Cloudflare R2 (storage), Cloudflare Workers AI and/or OpenRouter free
models (AI) — fits comfortably within free tiers for a pilot school or
a competition demo. The only thing that scales past free tiers with
real usage is AI call volume on paid models (Gemini beyond its free
quota) and database size well beyond a handful of schools — neither of
which this MVP phase needs to worry about.
