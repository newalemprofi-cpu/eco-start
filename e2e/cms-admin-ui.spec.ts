import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

async function login(page: import("@playwright/test").Page, identifier: string, urlPattern: RegExp, secret = PASSWORD) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(secret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(urlPattern);
}

test("school admin cannot reach the super-admin groups or news CMS, but can reach their own groups page", async ({
  page,
}) => {
  await login(page, "admin@ecostart.local", /\/app\/admin/);
  await page.goto("/kk/app/super-admin/groups");
  await expect(page).toHaveURL(/\/app\/admin/);

  await page.goto("/kk/app/super-admin/news");
  await expect(page).toHaveURL(/\/app\/admin/);

  await page.goto("/kk/app/admin/groups");
  await expect(page).toHaveURL(/\/app\/admin\/groups/);
  await expect(page.getByRole("heading", { name: "Топтар", exact: true })).toBeVisible();
});

test("teacher cannot reach the super-admin groups/news CMS or the admin groups page", async ({ page }) => {
  const { teacher } = await getFamilyFixture();
  await login(page, teacher.loginIdentifier, /\/app\/teacher/, teacher.plainSecret);
  await page.goto("/kk/app/super-admin/groups");
  await expect(page).toHaveURL(/\/app\/teacher/);

  await page.goto("/kk/app/super-admin/news");
  await expect(page).toHaveURL(/\/app\/teacher/);

  await page.goto("/kk/app/admin/groups");
  await expect(page).toHaveURL(/\/app\/teacher/);
});

test("unauthenticated visitor is redirected to login, not the CMS", async ({ page }) => {
  await page.goto("/kk/app/super-admin/groups");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/kk/app/super-admin/news");
  await expect(page).toHaveURL(/\/login/);
});

// "Дизайн баптауы" and "Бастапқы бет мазмұны" were removed from the
// SUPER_ADMIN panel this session — the routes are deleted entirely
// (not just permission-gated), so hitting them now 404s regardless of
// role. The published design/content those admin routes used to edit
// keeps rendering on the public site (cms.ts repo + tables untouched).
test("removed admin sections (design, homepage content) are gone — direct URLs 404", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  const designResponse = await page.goto("/kk/app/super-admin/design");
  expect(designResponse?.status()).toBe(404);

  const homepageResponse = await page.goto("/kk/app/super-admin/homepage");
  expect(homepageResponse?.status()).toBe(404);
});

test("super admin sidebar has Топтар, no Дизайн баптауы or Бастапқы бет мазмұны", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin");

  await expect(page.getByRole("link", { name: "Топтар", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Дизайн баптауы" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Бастапқы бет мазмұны" })).toHaveCount(0);
});

test("super admin groups page renders with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/groups");
  await expect(page.getByRole("heading", { name: "Топтар", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Жаңа топ қосу" })).toBeVisible();

  expect(errors, `console/page errors: ${errors.join("\n")}`).toEqual([]);
});

test("super admin news CMS renders seeded articles with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/news");
  await expect(page.getByRole("heading", { name: "Жаңалықтар", exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Жас экологтар күні", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Платформа жаңартылды: жаңа мүмкіндіктер қосылды", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Экологиялық сенбілік өтті", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Жаңа жаңалық қосу" })).toBeVisible();

  expect(errors, `console/page errors: ${errors.join("\n")}`).toEqual([]);
});
