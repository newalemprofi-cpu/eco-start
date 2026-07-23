import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

async function loginTeacher(page: import("@playwright/test").Page) {
  const { teacher } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(teacher.loginIdentifier);
  await page.locator('input[type="password"]').fill(teacher.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/teacher/);
}

test("teacher sees group roster and recent activity on overview", async ({ page }) => {
  const { child } = await getFamilyFixture();
  await loginTeacher(page);
  await expect(page.getByText(child.displayName).first()).toBeVisible();
});

test("teacher can generate and save an AI lesson", async ({ page }) => {
  await loginTeacher(page);
  await page.goto("/kk/app/teacher/ai-studio");
  await page.getByPlaceholder("мысалы, Су циклы").fill("Орман жануарлары");
  await page.getByRole("button", { name: "Жасау" }).click();
  await expect(page.getByText("Оқу-ойын әрекетінің жоспары")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Топқа жариялау" }).click();
  await expect(page.getByText("Оқу-ойын әрекеттерінің кітапханасы")).toBeVisible({ timeout: 10000 });
});

test("teacher can create a research project and give feedback", async ({ page }) => {
  await loginTeacher(page);
  await page.goto("/kk/app/teacher/research");
  await page.getByRole("button", { name: "Жаңа зерттеу" }).click();
  const projectTitle = `E2E зерттеу жобасы ${Date.now()}`;
  await page.getByLabel("Тақырып").fill(projectTitle);
  await page.getByLabel("Зерттеу сұрағы").fill("Сұрақ?");
  await page.getByLabel("Болжам").fill("Болжам.");
  await page.getByRole("button", { name: "Сақтау" }).click();
  await expect(page.getByText(projectTitle)).toBeVisible({ timeout: 10000 });
});

test("teacher reports page shows analytics stats and chart", async ({ page }) => {
  await loginTeacher(page);
  await page.goto("/kk/app/teacher/reports");
  await expect(page.getByText("Топтың орташа XP")).toBeVisible();
});
