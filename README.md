# Eco Start AI

*"Discover Nature • Explore • Create • Protect"*

An AI-powered environmental-education platform for preschools — one
central AI assistant (Eco AI) behind eight modules for children,
teachers, parents, and administrators. Built for the "Eco Start AI"
competition MVP; see [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md)
for the approved pre-development architecture blueprint this app was
built from, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how
the implementation maps to (and deliberately deviates from) that plan.

Primary language: **Kazakh** (kk). Also supports **Russian** (ru) and
**English** (en).

## What's implemented

- **Public landing page** — module showcase, role overview.
- **Auth** for all 5 roles (`CHILD`, `PARENT`, `TEACHER`, `SCHOOL_ADMIN`,
  `SUPER_ADMIN`) with Postgres Row-Level-Security-backed authorization.
- **Child app**: EcoLab AI (photo → AI recognition with safety
  filtering), Green Kindergarten (plant diary + growth chart), EcoGame
  (15 games across 5 reusable interaction templates), EcoResearch (mini research projects + charts),
  EcoPassport (XP/badges/certificates, downloadable PDF), EcoMedia
  Studio (AI story + storyboard generation, media upload), Eco AI
  Assistant (safe nature chat).
- **Teacher dashboard**: group roster, recent activity, AI Studio
  (one-topic → lesson plan + quiz + homework tip), research project
  management + feedback, EcoAnalytics reports.
- **Parent (EcoFamily) portal**: linked-child switcher, weekly summary,
  passport view, homework list.
- **Admin panel**: teachers/children/parents CRUD, content moderation,
  audit log.
- **Super Admin panel**: cross-school overview, AI provider
  configuration status (no key values ever shown), platform-wide audit
  log.
- **Real AI provider abstraction**: Gemini → Cloudflare Workers AI →
  OpenRouter → deterministic mock, with automatic fallback and a
  visible "dev mode" indicator when running on the mock. See
  [`docs/AI-SAFETY.md`](docs/AI-SAFETY.md).

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · shadcn/ui (Base UI primitives) · Zod · React Hook
Form · Recharts · React PDF · PostgreSQL (via `postgres.js`, no ORM —
see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)) · `next-intl`.

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)

No other accounts, API keys, or paid services are required to run
this locally.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (working defaults included — no edits needed to run locally)
cp .env.example .env.local

# 3. Start local PostgreSQL
docker compose up -d db

# 4. Apply the database schema
npm run db:migrate

# 5. Seed demo data (school, roles, sample content — see docs/DEMO-SCENARIO.md)
npm run db:seed

# 6. Start the dev server
npm run dev
```

Open http://localhost:3000 (Kazakh landing page, redirects to `/kk`).
Log in at `/kk/login` — the login page lists all 5 demo accounts and
the shared demo password when `NODE_ENV !== production`.

## Demo accounts

All seeded accounts share one password (also printed by `npm run
db:seed`): **`EcoStart2026!`** (override via `DEMO_ACCOUNT_PASSWORD` in
`.env.local`).

| Role | Identifier |
|---|---|
| Super Admin | `superadmin@ecostart.local` |
| School Admin | `admin@ecostart.local` |
| Teacher | `teacher@ecostart.local` |
| Parent | `parent@ecostart.local` |
| Child | `child@ecostart.local` (login code + PIN, same password) |

Full walkthrough script: [`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md).

## All commands

```bash
npm run dev          # start the dev server (Turbopack)
npm run build        # production build
npm run start         # run the production build
npm run lint          # eslint
npm run typecheck     # tsc --noEmit (strict)
npm run test           # vitest unit tests (single run)
npm run test:watch     # vitest in watch mode
npm run test:e2e       # Playwright end-to-end tests (dev server must be running)
npm run db:migrate     # apply pending SQL migrations (src/db/migrations)
npm run db:seed        # reset + seed demo data
```

Running the full verification suite locally, in order:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

For end-to-end tests, run the dev server in one terminal and, in
another:

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Troubleshooting

**Local Postgres uses host port 5434, not the default 5432.** This is
intentional, not a typo: on the reference dev machine, 5432 is already
bound by an unrelated project's Postgres container. Connecting to
"port 5432" in that situation doesn't fail loudly — it silently
connects to the *other* Postgres instance, which has no `app_user`
role, producing a confusing `password authentication failed for user
"app_user"` error instead of a connection error. `docker-compose.yml`
and `.env.example` both already use 5434 to avoid this. If 5434 is
*also* taken on your machine, remap both consistently: the host-side
port in `docker-compose.yml` (e.g. `"5435:5432"`) and `DATABASE_URL`/
`APP_DATABASE_URL` in `.env.local` to match. After changing either
file, fully restart `npm run dev` (env changes aren't picked up by
Fast Refresh alone).

**Symptom: `PostgresError: password authentication failed for user
"app_user"` even though `.env.local` looks correct.** Before assuming
a password mismatch, rule out a second Postgres instance answering on
the same port:
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```
If anything other than `eco-start-ai-db` is bound to the port in your
`DATABASE_URL`/`APP_DATABASE_URL`, that's the cause — move Eco Start's
Postgres to a free port as described above rather than re-checking
credentials.

**`docker compose up` fails with "port is already allocated".**
Something else on your machine is already using that port. Either stop
the other service, or remap as described above; `next dev` picks the
next free HTTP port automatically and prints which one it used.

## Environment variables

See [`.env.example`](.env.example) for the full list with inline
explanations. Everything needed to run locally has a working default —
nothing needs to be filled in to get started. The variables that
require real values only for production deployment (AI provider keys,
R2 credentials, Supabase connection strings) are documented in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Project structure

```
eco-start-ai/
├── docs/                    Architecture, deployment, AI safety, demo script, blueprint
├── e2e/                     Playwright end-to-end tests
├── scripts/                 migrate.ts, seed.ts (admin-connection-only)
├── src/
│   ├── app/[locale]/        App Router pages (marketing, login, per-role dashboards)
│   ├── app/api/              Route handlers (certificate PDF export)
│   ├── components/          Shared UI + per-role feature components
│   ├── db/
│   │   ├── migrations/      Plain SQL migrations (schema + RLS policies)
│   │   ├── repo/            Query layer — every function takes a TenantContext
│   │   └── client.ts         Runtime DB pool + withTenantContext (sets RLS session vars)
│   ├── i18n/                 next-intl routing + kk/ru/en message catalogs
│   ├── lib/
│   │   ├── ai/                Provider abstraction, prompts, safety filter, schemas
│   │   ├── auth/              Session (jose/JWT), DAL, RBAC, credentials
│   │   ├── domain/            Pure business logic (XP/leveling, game scoring)
│   │   ├── storage/           Local-disk / Cloudflare R2 adapters
│   │   └── validation/        Zod schemas per feature
│   └── proxy.ts               Next.js 16 "Proxy" (was Middleware) — locale + optimistic auth redirect
└── docker-compose.yml         Local PostgreSQL
```

## Known limitations

See the "Known limitations" section of
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the honest list —
things like in-memory (single-instance-only) rate limiting, real AI
provider code paths that are implemented but only exercised in this
environment via the mock, and scope deliberately cut from the original
blueprint for this MVP phase (e.g. no native mobile app, no AR/VR/IoT
yet — see blueprint §15 for that roadmap).
