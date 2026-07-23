# Demo Scenario

A walkthrough script covering every implemented module across all five
roles. Run `npm run db:seed` first (or again, to reset to a clean
state — it's idempotent) so the data below matches what you'll see.
All accounts share the password **`EcoStart2026!`**
(`DEMO_ACCOUNT_PASSWORD` in `.env.local`).

Seeded world: one school ("Демо балабақша №1 «Еркетай»"), one group
("Күншуақ тобы", ages 5–6), one teacher, one parent, three children,
an 8-entry species encyclopedia, the waste-sorting game, 5 achievements,
a sample greenhouse plant with a growth history, a sample research
project with two children's comparative observations, a published
sample lesson, and some game-session/recognition history for
analytics to have something to show.

## 1. Landing page (no login)

Visit `/kk` (or `/ru`, `/en` via the locale switcher). Scroll through
the module grid and the "Eco AI — the heart of the platform" section.
Try the theme toggle (light/dark) and the locale switcher — every
string on this page is translated, not just UI chrome.

## 2. Child — `child@ecostart.local`

The login page (`/kk/login`) lists all five demo accounts with
one-click autofill; click the "CHILD" card, then log in.

- **Home**: greeting, XP/level bar, today's rotating quest card,
  earned badges.
- **EcoLab AI** (`/app/child/ecolab`): tap "Сурет таңдау", upload any
  photo. The deterministic mock AI returns a species/object
  identification with a confidence bar. Upload a few times — you'll
  notice the mock provider is *deterministic*, not random: the exact
  same file always returns the exact same result. Watch for a run that
  returns "Қызыл мұқыт саңырауқұлақ" (a toxic mushroom) — the caution
  card and "ask your teacher" language appear automatically. This is
  the safety pipeline described in `docs/AI-SAFETY.md`, not a
  hand-written toxic-species special case.
- **Smart Green House** (`/app/child/greenhouse`): open the seeded
  "Менің күнбағысым" entry to see a real growth chart, then add a new
  plant and a new growth observation of your own.
- **EcoGame** (`/app/child/games/waste-sorting`): sort 6 items into
  paper/plastic/glass/organic bins, tap-based. See the score/XP result
  screen, then check "Әрекеттер тарихы" for the attempt history.
- **EcoResearch** (`/app/child/research`): open "Қай өсімдік тезірек
  өседі..." to see a two-child comparison chart (sun vs. shade), then
  add your own measurement.
- **EcoPassport** (`/app/child/passport`): XP/level, earned vs. locked
  badges, and a certificate — click "Жүктеп алу" to download a real
  generated PDF (Cyrillic-rendered, not a placeholder).
- **EcoMedia Studio** (`/app/child/studio`): type a topic, generate a
  short AI story, then generate a storyboard from it (scene-by-scene
  breakdown), then save the project. Separately, try the media upload
  form with any image.
- **Eco AI Assistant** (`/app/child/chat`): click a suggested question
  or type your own. Responses are short, simple, and end with a
  safety-note reminder to check with a teacher.

## 3. Teacher — `teacher@ecostart.local`

- **Overview**: the group roster (including the child you just played
  as), recent cross-child activity feed, and assignments.
- **AI Studio** (`/app/teacher/ai-studio`): type a topic (e.g. "Орман
  жануарлары"), pick an age band, generate. Watch the lesson plan, quiz,
  and homework tip populate, then "Топқа жариялау" (publish) — it now
  appears in the Lesson Library below and (as a homework item) in the
  parent's Homework tab.
- **Research** (`/app/teacher/research`): create a new project, or
  leave feedback on the existing "Қай өсімдік тезірек өседі" project —
  the child sees that feedback immediately on their own project page.
- **Reports** (`/app/teacher/reports`): group-level stat tiles (average
  XP, active children this week, game sessions, research observations)
  and a per-child XP bar chart.

## 4. Parent — `parent@ecostart.local`

- **Overview**: linked-children switcher (this demo parent has two
  linked children), a "this week" XP/badges summary card, and a recent
  activity feed for the selected child.
- **Passport**: the same badges/certificates view as the child sees,
  read-only, with the same certificate download.
- **Homework**: the lesson you just published as the teacher shows up
  here with its due date.

## 5. School Admin — `admin@ecostart.local`

- **Overview**: school-wide stat tiles and a recent audit-log preview.
- **Teachers / Children / Parents**: each is a real data table with an
  "add" dialog. Add a teacher — it's immediately assigned to the
  seeded group and requires a real email + password (bcrypt-hashed
  server-side, never stored in plaintext). Add a child — note the
  login-code + PIN fields (this is exactly how the seeded
  `child@ecostart.local` demo account itself is defined); the new
  child can log in immediately with what you entered.
- **Content**: the games catalog, and every media asset created across
  the school (including whatever you saved in the child's EcoMedia
  Studio) with a visibility dropdown
  (private/shared_family/shared_school) — change it and see it persist.
- **Audit Log**: every admin mutation you just made (teacher/child
  creation, media visibility changes) is recorded with actor, action,
  and timestamp.

## 6. Super Admin — `superadmin@ecostart.local`

- **Overview**: cross-school stat tiles and AI usage broken down by
  provider (you'll see `mock` with a nonzero call count if you didn't
  configure real AI keys — see below).
- **Schools**: the school list (one seeded school; this view is built
  to scale to many).
- **AI Settings** (`/app/super-admin/ai-config`): shows exactly which
  of Gemini/Cloudflare/OpenRouter/mock is configured — booleans only,
  **no key values are ever displayed**, matching the data-protection
  requirement that provider secrets never leak into any UI.
- **Audit Log**: the same audit trail as the school admin's, but across
  every school.

## 7. Things worth specifically pointing out to a reviewer

- **RBAC is enforced server-side, not just hidden in the UI.** Try
  navigating a teacher session directly to `/kk/app/admin` — you're
  redirected to `/kk/app/teacher`, not shown a broken page or an admin
  view with hidden buttons.
- **Log out, then try visiting any `/app/...` URL directly** — you're
  redirected to `/login`, and after logging back in you land on the
  correct role's dashboard automatically.
- **The "dev mode" signal**: with no AI keys configured (the default
  local setup), every AI-backed page is functioning entirely on the
  deterministic mock provider — this is the "runs without paid API
  keys" requirement in practice, not just a claim. Configuring a real
  `GEMINI_API_KEY` (see `docs/DEPLOYMENT.md`) switches live traffic to
  Gemini with zero code changes, visible via the "provider" badge shown
  after each AI generation.
- **Switch languages mid-session** (locale switcher, top-right, on any
  page) — the same data renders in Kazakh, Russian, or English,
  including AI-generated content, which is generated natively in the
  selected locale rather than translated after the fact.
