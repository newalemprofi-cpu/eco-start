import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

test("child can generate a story and save it as a project", async ({ page }) => {
  const { child } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(child.loginIdentifier);
  await page.locator('input[type="password"]').fill(child.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/child/);

  await page.goto("/kk/app/child/studio");
  await page.getByPlaceholder("Орман, өзен, көбелек...").fill("Кішкентай қоян");
  await page.getByRole("button", { name: "Story" }).click();
  await expect(page.getByRole("button", { name: "Storyboard" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1500);
});

test("parent sees linked child overview and passport", async ({ page }) => {
  const { parent } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(parent.loginIdentifier);
  await page.locator('input[type="password"]').fill(parent.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/parent/);
  await expect(page.getByText("Осы аптада")).toBeVisible();

  await page.goto("/kk/app/parent/passport");
  await expect(page.getByText("Белгілер")).toBeVisible();
});
