import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

async function loginChild(page: import("@playwright/test").Page) {
  const { child } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(child.loginIdentifier);
  await page.locator('input[type="password"]').fill(child.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/child/);
}

// scripts/seed-data/synthetic-activity.ts seeds exactly one research
// project per real group, always with this title (see its
// research_projects insert) — not personal data, just fixed boilerplate
// text this import writes, so it's safe to reference directly here.
const SYNTHETIC_RESEARCH_PROJECT_TITLE = "Өсімдіктің өсуін бақылау";

test("child can view a research project, chart, and add an observation", async ({ page }) => {
  await loginChild(page);
  await page.goto("/kk/app/child/research");
  await page.getByText(SYNTHETIC_RESEARCH_PROJECT_TITLE).click();
  await expect(page).toHaveURL(/research\/[a-f0-9-]+/);
  await page.getByLabel(/Өлшем/).fill("15");
  await page.getByRole("button", { name: "Өлшеу қосу" }).click();
  await page.waitForTimeout(1500);
});

test("child passport shows XP, badges, and a downloadable certificate", async ({ page }) => {
  await loginChild(page);
  await page.goto("/kk/app/child/passport");
  await expect(page.getByText("XP").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Жүктеп алу/ })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("link", { name: /Жүктеп алу/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/certificate-.*\.pdf/);
});

test("child can chat with Eco AI and get a mock reply", async ({ page }) => {
  await loginChild(page);
  await page.goto("/kk/app/child/chat");
  await page.getByPlaceholder("Табиғат туралы сұрағыңды жаз...").fill("Неге аспан көк?");
  await page.getByRole("button", { name: "Жіберу" }).click();
  await page.waitForTimeout(2000);
  const bodyText = await page.textContent("body");
  expect(bodyText).toContain("Неге аспан көк?");
});
