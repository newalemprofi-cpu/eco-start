import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

async function login(page: import("@playwright/test").Page, identifier: string, secret = PASSWORD) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(secret);
  await page.getByRole("button", { name: "Кіру" }).click();
}

test("landing page renders the hero and modules", async ({ page }) => {
  await page.goto("/kk");
  // The hero is the news carousel (see news-carousel.tsx) — it replaced
  // the old static marketing banner this session, so the hero check is
  // "the news carousel renders with a real article headline" rather
  // than a fixed marketing string.
  await expect(page.getByRole("region", { name: "Жаңалықтар каруселі" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Эко Зертхана" })).toBeVisible();
});

test("unauthenticated user is redirected away from a protected route", async ({ page }) => {
  await page.goto("/kk/app/teacher");
  await expect(page).toHaveURL(/\/kk\/login/);
});

test("teacher can log in and reach the teacher dashboard", async ({ page }) => {
  const { teacher } = await getFamilyFixture();
  await login(page, teacher.loginIdentifier, teacher.plainSecret);
  await expect(page).toHaveURL(/\/app\/teacher/);
  await expect(page.getByText(teacher.displayName)).toBeVisible();
});

test("child can log in via login code + PIN and see XP/level", async ({ page }) => {
  const { child } = await getFamilyFixture();
  await login(page, child.loginIdentifier, child.plainSecret);
  await expect(page).toHaveURL(/\/app\/child/);
  await expect(page.getByText(new RegExp(`Сәлем, ${child.displayName.split(" ")[0]}`))).toBeVisible();
});

test("wrong password is rejected with a generic error", async ({ page }) => {
  const { teacher } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(teacher.loginIdentifier);
  await page.locator('input[type="password"]').fill("wrong-password-123");
  await page.getByRole("button", { name: "Кіру" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/kk\/login/);
});

test("logout clears the session and redirects to login", async ({ page }) => {
  const { parent } = await getFamilyFixture();
  await login(page, parent.loginIdentifier, parent.plainSecret);
  await expect(page).toHaveURL(/\/app\/parent/);
  await page.getByRole("button", { name: /Шығу/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/kk/app/parent");
  await expect(page).toHaveURL(/\/kk\/login/);
});
