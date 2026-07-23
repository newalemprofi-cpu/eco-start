import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

const TEST_IMAGE = process.env.E2E_TEST_IMAGE;

test("child can upload a photo and get an AI recognition result", async ({ page }) => {
  test.skip(!TEST_IMAGE, "E2E_TEST_IMAGE not set");

  const { child } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(child.loginIdentifier);
  await page.locator('input[type="password"]').fill(child.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/child/);

  await page.goto("/kk/app/child/ecolab");
  await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE!);

  await expect(page.getByText(/XP/)).toBeVisible({ timeout: 15000 });
});
