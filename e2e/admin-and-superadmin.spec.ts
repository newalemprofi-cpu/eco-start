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

test("admin can view overview and add a teacher", async ({ page }) => {
  await login(page, "admin@ecostart.local", /\/app\/admin/);
  await expect(page.getByRole("heading", { name: "Бөбекжай көрінісі" })).toBeVisible();

  await page.goto("/kk/app/admin/teachers");
  await page.getByRole("button", { name: "Тәрбиеші қосу" }).click();
  await page.getByLabel("Аты-жөні").fill("E2E Тәрбиеші");
  await page.getByLabel("Email").fill(`e2e-teacher-${Date.now()}@ecostart.local`);
  await page.getByLabel("Құпия сөз").fill("TestPass123!");
  await page.getByRole("button", { name: "Сақтау" }).click();
  await expect(page.getByText("E2E Тәрбиеші")).toBeVisible({ timeout: 10000 });
});

test("admin can add a child and moderate content", async ({ page }) => {
  await login(page, "admin@ecostart.local", /\/app\/admin/);
  await page.goto("/kk/app/admin/children");
  await page.getByRole("button", { name: "Бала қосу" }).click();
  await page.getByLabel("Аты-жөні").fill("E2E Бала");
  await page.getByLabel("Кіру коды").fill(`e2e-child-${Date.now()}`);
  await page.getByLabel("PIN-код").fill("4321");
  await page.getByRole("button", { name: "Сақтау" }).click();
  await expect(page.getByText("E2E Бала")).toBeVisible({ timeout: 10000 });

  await page.goto("/kk/app/admin/content");
  await expect(page.getByText("Ойындар")).toBeVisible();
});

test("super admin can see schools and AI provider status", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await expect(page.getByText("№37 «Жұлдыз-ай» бөбекжайы")).toBeVisible();

  await page.goto("/kk/app/super-admin/ai-config");
  await expect(page.getByText("mock", { exact: true })).toBeVisible();
  await expect(page.getByText("Бапталған").first()).toBeVisible();
});

test("non-admin cannot reach the admin dashboard", async ({ page }) => {
  const { teacher } = await getFamilyFixture();
  await login(page, teacher.loginIdentifier, /\/app\/teacher/, teacher.plainSecret);
  await page.goto("/kk/app/admin");
  await expect(page).toHaveURL(/\/app\/teacher/);
});
