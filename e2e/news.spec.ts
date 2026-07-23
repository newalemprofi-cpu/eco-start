import { expect, test } from "@playwright/test";

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

async function login(page: import("@playwright/test").Page, identifier: string, urlPattern: RegExp) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(urlPattern);
}

// A newly created news item always gets display_order = max+1 (see
// createNewsDraft in src/db/repo/news.ts), so it's always the LAST card
// in the list — a stable anchor, same convention as cms-publish-flow.spec.ts.
function lastNewsCard(page: import("@playwright/test").Page) {
  return page.locator('[data-testid^="news-card-"]').last();
}

const SEEDED_TITLES = [
  "Жас экологтар күні",
  "Платформа жаңартылды: жаңа мүмкіндіктер қосылды",
  "Экологиялық сенбілік өтті",
];

test("news list page shows all seeded articles, newest first", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/kk/news");
  await expect(page.getByRole("heading", { name: "Жаңалықтар", exact: true })).toBeVisible();

  for (const title of SEEDED_TITLES) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }

  const headings = page.locator("h2");
  const order = await headings.allTextContents();
  const positions = SEEDED_TITLES.map((t) => order.indexOf(t));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));

  expect(errors, errors.join("\n")).toEqual([]);
});

test("Толығырақ opens the correct article page", async ({ page }) => {
  await page.goto("/kk/news");
  const card = page.locator("a", { hasText: "Жас экологтар күні" }).first();
  await card.click();
  await expect(page).toHaveURL(/\/kk\/news\/zhas-ekologtar-kuni$/);
  await expect(page.getByRole("heading", { name: "Жас экологтар күні", exact: true })).toBeVisible();
});

test("article page shows title/date/author/body and a working back link", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/kk/news/zhas-ekologtar-kuni");
  await expect(page.getByRole("heading", { name: "Жас экологтар күні", exact: true })).toBeVisible();
  await expect(page.getByText(/\d{4}/)).toBeVisible();

  const backLink = page.getByRole("link", { name: "Барлық жаңалықтарға оралу" });
  await expect(backLink).toBeVisible();
  await backLink.click();
  await expect(page).toHaveURL(/\/kk\/news$/);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("a non-existent news slug returns 404", async ({ page }) => {
  const response = await page.goto("/kk/news/this-slug-does-not-exist-ever");
  expect(response?.status()).toBe(404);
});

test("homepage carousel shows featured news with dots, prev/next, and whole-slide link", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/kk");
  const region = page.getByRole("region", { name: "Жаңалықтар каруселі" });
  await expect(region).toBeVisible();

  const dots = region.locator('button[aria-label$="-жаңалыққа өту"]');
  await expect(dots).toHaveCount(6);
  await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(region.getByRole("heading", { name: "Жас экологтар күні", exact: true })).toBeVisible();

  await region.getByRole("button", { name: "Келесі жаңалық" }).click();
  await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
  await expect(
    region.getByRole("heading", { name: "Платформа жаңартылды: жаңа мүмкіндіктер қосылды", exact: true })
  ).toBeVisible();

  await region.getByRole("button", { name: "Алдыңғы жаңалық" }).click();
  await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");

  const readMoreLink = region.getByRole("link", { name: /Толығырақ оқу/ });
  await expect(readMoreLink).toBeVisible();
  await readMoreLink.click();
  await expect(page).toHaveURL(/\/kk\/news\/zhas-ekologtar-kuni$/);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("SUPER_ADMIN can create, publish, unpublish, and delete a news item", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/news");
  await expect(page.getByRole("heading", { name: "Жаңалықтар", exact: true })).toBeVisible();

  const uniqueTitle = `E2E жаңалық ${Date.now()}`;
  const uniqueSlug = `e2e-news-${Date.now()}`;
  const countBefore = await page.locator('[data-testid^="news-card-"]').count();
  await page.getByRole("button", { name: "Жаңа жаңалық қосу" }).click();
  await expect(page.locator('[data-testid^="news-card-"]')).toHaveCount(countBefore + 1, { timeout: 10000 });

  const newCard = lastNewsCard(page);
  await newCard.locator('input[id^="title-"]').fill(uniqueTitle);
  await newCard.locator('input[id^="slug-"]').fill(uniqueSlug);
  await newCard.locator('textarea[id^="excerpt-"]').fill("E2E test excerpt.");
  await newCard.locator('textarea[id^="body-"]').fill("E2E test body content.");
  await newCard.getByRole("switch", { name: "Басты бетте" }).click();
  await newCard.getByRole("button", { name: "Жоба нұсқасын сақтау" }).click();
  await expect(page.getByText("Жоба нұсқасы сақталды")).toBeVisible({ timeout: 10000 });

  // A saved-but-unpublished draft must not leak to the public site.
  await page.goto("/kk/news");
  await expect(page.getByText(uniqueTitle)).toHaveCount(0);
  const draftResponse = await page.goto(`/kk/news/${uniqueSlug}`);
  expect(draftResponse?.status()).toBe(404);

  await page.goto("/kk/app/super-admin/news");
  const savedCard = page.locator('[data-testid^="news-card-"]').filter({ hasText: uniqueTitle }).first();
  await savedCard.getByRole("button", { name: "Жариялау", exact: true }).click();
  await expect(page.getByText("Жарияланды")).toBeVisible({ timeout: 10000 });

  await page.goto("/kk/news");
  await expect(page.getByText(uniqueTitle)).toBeVisible();
  await page.goto(`/kk/news/${uniqueSlug}`);
  await expect(page.getByRole("heading", { name: uniqueTitle, exact: true })).toBeVisible();

  // Homepage-carousel inclusion isn't checked here — a newly created
  // article gets the highest display_order (see createNewsDraft), and
  // with 30 real seeded articles now occupying the low end of that
  // range, a fresh item never lands in the carousel's top-6 without an
  // explicit reorder. That reorder mechanic has its own dedicated test
  // below ("reordering featured news via the editor...").

  // Unpublish: disappears from the public site, but the draft stays editable.
  await page.goto("/kk/app/super-admin/news");
  const publishedCard = page.locator('[data-testid^="news-card-"]').filter({ hasText: uniqueTitle }).first();
  await publishedCard.getByRole("button", { name: "Жариялауды тоқтату" }).click();
  await expect(page.getByText("Жариялау тоқтатылды")).toBeVisible({ timeout: 10000 });

  await page.goto("/kk/news");
  await expect(page.getByText(uniqueTitle)).toHaveCount(0);
  const response = await page.goto(`/kk/news/${uniqueSlug}`);
  expect(response?.status()).toBe(404);

  await page.goto("/kk/app/super-admin/news");
  const stillDraftCard = page.locator('[data-testid^="news-card-"]').filter({ hasText: uniqueTitle }).first();
  await expect(stillDraftCard.locator('input[id^="title-"]')).toHaveValue(uniqueTitle);

  // Delete: gone entirely.
  page.once("dialog", (d) => d.accept());
  await stillDraftCard.getByRole("button", { name: "Жою" }).click();
  await expect(page.getByText("Жаңалық жойылды")).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid^="news-card-"]').filter({ hasText: uniqueTitle })).toHaveCount(0);
});

test("a never-published draft never appears on the homepage, news list, or its own slug URL", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/news");

  const uniqueTitle = `Draft only ${Date.now()}`;
  const uniqueSlug = `draft-only-${Date.now()}`;
  const countBefore = await page.locator('[data-testid^="news-card-"]').count();
  await page.getByRole("button", { name: "Жаңа жаңалық қосу" }).click();
  await expect(page.locator('[data-testid^="news-card-"]')).toHaveCount(countBefore + 1, { timeout: 10000 });

  const newCard = lastNewsCard(page);
  await newCard.locator('input[id^="title-"]').fill(uniqueTitle);
  await newCard.locator('input[id^="slug-"]').fill(uniqueSlug);
  await newCard.getByRole("button", { name: "Жоба нұсқасын сақтау" }).click();
  await expect(page.getByText("Жоба нұсқасы сақталды")).toBeVisible({ timeout: 10000 });

  await page.goto("/kk");
  await expect(page.getByText(uniqueTitle)).toHaveCount(0);
  await page.goto("/kk/news");
  await expect(page.getByText(uniqueTitle)).toHaveCount(0);
  const response = await page.goto(`/kk/news/${uniqueSlug}`);
  expect(response?.status()).toBe(404);

  // Clean up.
  await page.goto("/kk/app/super-admin/news");
  const cleanupCard = page.locator('[data-testid^="news-card-"]').filter({ hasText: uniqueTitle }).first();
  page.once("dialog", (d) => d.accept());
  await cleanupCard.getByRole("button", { name: "Жою" }).click();
  await expect(page.getByText("Жаңалық жойылды")).toBeVisible({ timeout: 10000 });
});

// reorderFeaturedNews only updates the *draft* row's display_order (same
// convention as reorderBannerCarousel in cms.ts) — the public homepage
// reads display_order off the *published* rows, so a reorder only takes
// effect on the live carousel once the reordered items are republished.
// Waits for the actual publishNewsAction POST round-trip rather than the
// "Жарияланды" toast text — back-to-back publishes on the same loaded
// page can leave the previous toast still on screen, so asserting on
// toast text alone can pass before the second server action has finished.
async function publishByTitle(page: import("@playwright/test").Page, title: string) {
  const card = page.locator('[data-testid^="news-card-"]').filter({ hasText: title }).first();
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/app/super-admin/news") && res.request().method() === "POST"),
    card.getByRole("button", { name: "Жариялау", exact: true }).click(),
  ]);
  expect(response.ok()).toBe(true);
}

test("reordering featured news via the editor changes the homepage carousel's slide order", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/news");

  const firstCard = page.locator('[data-testid^="news-card-"]').filter({ hasText: SEEDED_TITLES[0] }).first();
  // The move up/down arrows are the first two <button>s in DOM order
  // within each card (see news-editor.tsx's NewsCard header row).
  const moveDownButton = firstCard.locator("button").nth(1);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/app/super-admin/news") && res.request().method() === "POST"),
    moveDownButton.click(),
  ]);
  await publishByTitle(page, SEEDED_TITLES[0]);
  await publishByTitle(page, SEEDED_TITLES[1]);

  await page.goto("/kk");
  const region = page.getByRole("region", { name: "Жаңалықтар каруселі" });
  const dots = region.locator('button[aria-label$="-жаңалыққа өту"]');
  await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(region.getByRole("heading", { name: SEEDED_TITLES[1], exact: true })).toBeVisible();

  // Restore original order so the rest of the suite isn't affected.
  await page.goto("/kk/app/super-admin/news");
  const movedCard = page.locator('[data-testid^="news-card-"]').filter({ hasText: SEEDED_TITLES[0] }).first();
  const moveUpButton = movedCard.locator("button").nth(0);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/app/super-admin/news") && res.request().method() === "POST"),
    moveUpButton.click(),
  ]);
  await publishByTitle(page, SEEDED_TITLES[0]);
  await publishByTitle(page, SEEDED_TITLES[1]);

  await page.goto("/kk");
  await expect(region.getByRole("heading", { name: SEEDED_TITLES[0], exact: true })).toBeVisible();
});
