import { expect, test, type Page } from "@playwright/test";

/**
 * Covers the 9-task functional/UX update end to end, using the SEEDED
 * DEMO accounts — so it only makes sense against an isolated test
 * database seeded with `npm run db:seed` (never production; the demo
 * accounts don't exist there). Opt-in: set E2E_DEMO=1.
 *   E2E_DEMO=1 E2E_BASE_URL=http://localhost:3100 npx playwright test e2e/feature-update-demo.spec.ts
 */
test.skip(!process.env.E2E_DEMO, "E2E_DEMO not set — demo-account spec runs only against a seeded test DB");

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

async function login(page: Page, identifier: string, urlPart: RegExp) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Кіру", exact: true }).click();
  await page.waitForURL(urlPart);
}

test("homepage module and role cards open public info pages with a separate login button", async ({ page }) => {
  await page.goto("/kk");
  await page.getByRole("link", { name: "Жасыл бөбекжай" }).first().click();
  await expect(page).toHaveURL(/\/kk\/modules\/greenhouse/);
  await expect(page.getByRole("heading", { name: "Статистика" })).toBeVisible();
  await expect(page.getByText("Мүмкіндіктері")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Кіру" })).toHaveAttribute("href", /login\?next=/);

  await page.goto("/kk");
  await page.getByRole("link", { name: "Тәрбиеші", exact: true }).click();
  await expect(page).toHaveURL(/\/kk\/roles\/TEACHER/);
  await expect(page.getByText("Платформаны қалай қолдану")).toBeVisible();
  await expect(page.getByRole("link", { name: "Жүйеге кіру" })).toBeVisible();
});

test("teacher generates a 3-4 lesson, publishes it to the group, and the child sees it", async ({ page, browser }) => {
  const topic = `Күз жапырақтары ${Date.now()}`;
  await login(page, "teacher@ecostart.local", /\/app\/teacher/);
  await page.goto("/kk/app/teacher/ai-studio");
  await page.getByPlaceholder("мысалы, Су циклы").fill(topic);
  await page.getByLabel("Жас тобы").click();
  await page.getByRole("option", { name: "3–4 жас" }).click();
  await page.getByRole("button", { name: "Жасау" }).click();
  await expect(page.getByText("Оқу-ойын әрекетінің жоспары")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("~10 мин").first()).toBeVisible();
  await page.getByRole("button", { name: "Топқа жариялау", exact: true }).click();
  await expect(page.getByText(/бала көре алады/).first()).toBeVisible({ timeout: 10000 });

  const childPage = await (await browser.newContext()).newPage();
  await login(childPage, "child@ecostart.local", /\/app\/child/);
  await childPage.goto("/kk/app/child/lessons");
  await childPage.getByText(topic).click();
  await expect(childPage.getByText("Ойлан да, бас!")).toBeVisible();
});

test("teacher creates and publishes research; child adds a tap-only observation", async ({ page, browser }) => {
  const title = `E2E зерттеу ${Date.now()}`;
  await login(page, "teacher@ecostart.local", /\/app\/teacher/);
  await page.goto("/kk/app/teacher/research");
  await page.getByRole("button", { name: "Жаңа зерттеу" }).click();
  await page.getByLabel("Тақырып").fill(title);
  await page.getByLabel("Зерттеу сұрағы").fill("Су неге қажет?");
  await page.getByLabel("Болжам").fill("Өсімдік суды жақсы көреді.");
  await page.getByLabel(/Балаларға тапсырмалар/).fill("Суар\nӨлше");
  await page.getByRole("button", { name: "Сақтау" }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

  const childPage = await (await browser.newContext()).newPage();
  await login(childPage, "child@ecostart.local", /\/app\/child/);
  await childPage.goto("/kk/app/child/research");
  await childPage.getByText(title).click();
  await expect(childPage.getByRole("listitem").filter({ hasText: "Суар" }).first()).toBeVisible();
  await childPage.getByRole("button", { name: "Көбейту" }).click();
  await childPage.getByRole("button", { name: /Өсті/ }).click();
  await childPage.getByRole("button", { name: "Өлшеу қосу" }).click();
  await expect(childPage.getByText("Менің бақылауларым")).toBeVisible({ timeout: 10000 });
});

test("analytics cards drill down to a child's full report", async ({ page }) => {
  await login(page, "teacher@ecostart.local", /\/app\/teacher/);
  await page.goto("/kk/app/teacher/reports");
  await page.getByText("Белсенді балалар").first().click();
  await expect(page.getByText("Балалар белсенділігі")).toBeVisible();
  await page.getByRole("link", { name: /Демо бала — Айым/ }).click();
  await expect(page.getByText("Орындаған ойындары")).toBeVisible();
  await expect(page.getByText("Белсенділік динамикасы")).toBeVisible();

  await page.goto("/kk/app/teacher/reports?view=games");
  await expect(page.getByText("Ойындар бойынша")).toBeVisible();
});

test("child adds a vegetable and logs leaves by picture", async ({ page }) => {
  await login(page, "child@ecostart.local", /\/app\/child/);
  await page.goto("/kk/app/child/greenhouse");
  await page.getByRole("button", { name: "Жаңа өсімдік қосу" }).click();
  await page.getByRole("tab", { name: /Көкөністер/ }).click();
  await page.getByRole("button", { name: /Сәбіз/ }).click();
  await page.getByRole("button", { name: "Сақтау" }).click();
  await page.getByRole("link", { name: /Сәбіз/ }).first().click();
  await expect(page).toHaveURL(/greenhouse\/[a-f0-9-]+/);
  await page.getByRole("button", { name: "4 жапырақ" }).click();
  await page.getByRole("button", { name: /Өскін/ }).click();
  await page.getByRole("button", { name: "Бақылау қосу" }).click();
  await expect(page.getByLabel("4 жапырақ").last()).toBeVisible({ timeout: 10000 });
});

test("ecolab offers camera + gallery and opens a full card for a studied object", async ({ page }) => {
  await login(page, "child@ecostart.local", /\/app\/child/);
  await page.goto("/kk/app/child/ecolab");
  await expect(page.getByRole("button", { name: "Фото түсіру" })).toBeVisible();
  await expect(page.getByLabel("Фото түсіру")).toHaveAttribute("capture", "environment");
  // 1x1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  await page.getByLabel("Галереядан таңдау").setInputFiles({ name: "leaf.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Иә, тексер!" }).click();
  await page.getByRole("link", { name: /Толығырақ/ }).click({ timeout: 15000 });
  await expect(page).toHaveURL(/ecolab\/[a-f0-9-]+/);
  await expect(page.getByText("AI не деді")).toBeVisible();
  await expect(page.getByText(/Бұрынғы зерттеулер/)).toBeVisible();
});
