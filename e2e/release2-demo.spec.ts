import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { RELEASE2_GAMES } from "../scripts/seed-data/release2-games";

/**
 * Release 2 end to end (branding, user management, session revocation,
 * games XP, photos) with the SEEDED DEMO accounts — only against an
 * isolated, freshly seeded test database, never production.
 * Opt-in: E2E_DEMO=1.
 *   E2E_DEMO=1 E2E_BASE_URL=http://localhost:3100 npx playwright test e2e/release2-demo.spec.ts
 */
test.skip(!process.env.E2E_DEMO, "E2E_DEMO not set — demo-account spec runs only against a seeded test DB");
test.describe.configure({ mode: "serial" });

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function login(page: Page, identifier: string, secret = PASSWORD) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(secret);
  await page.getByRole("button", { name: "Кіру", exact: true }).click();
}

async function as(browser: Browser, identifier: string) {
  const page = await (await browser.newContext()).newPage();
  await login(page, identifier);
  await page.waitForURL(/\/app\//);
  return page;
}

function rowOf(page: Page, name: string | RegExp) {
  return page.getByRole("row").filter({ hasText: name });
}

test("branding: ЭКО ҚАДАМ in the browser title, homepage and login — no old name", async ({ page }) => {
  await page.goto("/kk");
  await expect(page).toHaveTitle(/ЭКО ҚАДАМ/);
  const home = await page.locator("body").innerText();
  expect(home).toContain("ЭКО ҚАДАМ");
  expect(home).not.toMatch(/Eco Start|Эко Start|Эко Старт/i);
  await page.goto("/kk/login");
  expect(await page.locator("body").innerText()).not.toMatch(/Eco Start|Эко Start|Эко Старт/i);
});

test("admin changes a teacher to Педагог-ассистент and back (RBAC-checked server action)", async ({ browser }) => {
  const admin = await as(browser, "admin@ecostart.local");
  await admin.goto("/kk/app/admin/teachers");
  const row = rowOf(admin, "teacher@ecostart.local");
  await row.getByRole("button", { name: "Өңдеу" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("combobox").first().click();
  await admin.getByRole("option", { name: "Педагог-ассистент" }).click();
  await dialog.getByRole("button", { name: /Сақтау/ }).click();
  await expect(dialog).toBeHidden();
  await expect(rowOf(admin, "teacher@ecostart.local")).toContainText("Педагог-ассистент");

  await rowOf(admin, "teacher@ecostart.local").getByRole("button", { name: "Өңдеу" }).click();
  await admin.getByRole("dialog").getByRole("combobox").first().click();
  await admin.getByRole("option", { name: "Тәрбиеші", exact: true }).click();
  await admin.getByRole("dialog").getByRole("button", { name: /Сақтау/ }).click();
  await expect(rowOf(admin, "teacher@ecostart.local")).toContainText("Тәрбиеші");
});

test("archiving a child ends their open session and blocks login; restoring brings them back", async ({ browser }) => {
  const child = await as(browser, "demo-child-3");
  await expect(child).toHaveURL(/\/app\/child/);

  const admin = await as(browser, "admin@ecostart.local");
  await admin.goto("/kk/app/admin/children");
  await rowOf(admin, "demo-child-3").getByRole("button", { name: "Архивтеу" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Иә, архивтеу" }).click();
  await expect(rowOf(admin, "demo-child-3")).toHaveCount(0);

  // The child's still-signed JWT is refused on the very next request.
  await child.goto("/kk/app/child");
  await expect(child).toHaveURL(/\/kk\/login\?ended=1/);
  await expect(child.getByRole("status")).toContainText("Сеанс аяқталды");
  await login(child, "demo-child-3");
  await expect(child.locator("p[role=alert]")).toBeVisible();
  await expect(child).toHaveURL(/\/login/);

  await admin.goto("/kk/app/admin/children?view=archived");
  await rowOf(admin, "demo-child-3").getByRole("button", { name: "Қалпына келтіру" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Қалпына келтіру" }).click();
  await expect(admin.getByRole("dialog")).toBeHidden();
  await admin.goto("/kk/app/admin/children");
  await expect(rowOf(admin, "demo-child-3")).toHaveCount(1);
});

test("a 5–6 game pays XP once: first round +40 XP, replay +0 with a friendly note", async ({ browser }) => {
  const child = await as(browser, "child@ecostart.local"); // KUN-01, 5–6
  const game = RELEASE2_GAMES.find((g) => g.key === "r2-nature-explorer")!;
  const rounds = (game.config as { rounds: { items: { label: { kk: string }; isTarget: boolean }[] }[] }).rounds;

  async function playPerfectRound() {
    await child.goto(`/kk/app/child/games/${game.key}`);
    for (let i = 0; i < rounds.length; i++) {
      const ok = child.getByRole("button", { name: "OK" });
      await expect(ok).toBeVisible();
      // Rounds are shuffled: recognise the current one by its tiles.
      const labels = await child.locator("main [aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      const current = rounds.find((r) => r.items.every((it) => labels.includes(it.label.kk)))!;
      for (const it of current.items.filter((x) => x.isTarget)) {
        await child.getByRole("button", { name: it.label.kk, exact: true }).click();
      }
      await ok.click();
      await child.waitForTimeout(1100);
    }
  }

  await playPerfectRound();
  await expect(child.getByText(`+${game.xpReward} XP`)).toBeVisible({ timeout: 15000 });
  await playPerfectRound();
  await expect(child.getByText("+0 XP")).toBeVisible({ timeout: 15000 });
  await expect(child.getByText("XP-ін бұрын жинап қойдың")).toBeVisible();
});

test("photos: the child's own photo shows; the teacher sees it in the child report; the parent on their page", async ({ browser }) => {
  const child = await as(browser, "child@ecostart.local");
  await child.goto("/kk/app/child/ecolab");
  await child.getByLabel("Галереядан таңдау").setInputFiles({ name: "leaf.png", mimeType: "image/png", buffer: PNG });
  await child.getByRole("button", { name: "Иә, тексер!" }).click();
  await child.getByRole("link", { name: /Толығырақ/ }).click({ timeout: 15000 });
  await child.waitForURL(/\/ecolab\/[0-9a-f-]{36}$/);
  const src = (await child.locator("main img").first().getAttribute("src")) ?? "";
  expect(src).toMatch(/^\/uploads\/recognitions\//);
  expect((await child.request.get(src)).status()).toBe(200);
  await child.goto("/kk/app/child/ecolab");
  await expect(child.locator(`main img[src="${src}"]`).first()).toBeVisible();

  const childId = src.split("/")[4];
  const teacher = await as(browser, "teacher@ecostart.local");
  await teacher.goto(`/kk/app/teacher/reports/child/${childId}`);
  await expect(teacher.getByText("Эко Зертхана суреттері")).toBeVisible();
  expect((await teacher.request.get(src)).status()).toBe(200);

  const parent = await as(browser, "parent@ecostart.local");
  await parent.goto("/kk/app/parent");
  await expect(parent.getByText("Эко Зертхана суреттері")).toBeVisible();
  expect((await parent.request.get(src)).status()).toBe(200);

  // A classmate (other child) gets 404, anonymous 401 — no change from P0.
  const classmate = await as(browser, "demo-child-2");
  const denied = await classmate.request.get(src);
  expect(denied.status()).toBe(404);
  expect(denied.headers()["x-media-reason"]).toBeUndefined(); // no existence oracle for outsiders
  const anon = await (await browser.newContext()).request.get(src);
  expect(anon.status()).toBe(401);

  uploadedPhoto = src;
});

let uploadedPhoto = "";

test("401 / 404-no-access / 404-file-missing are told apart; a missing file shows 'Сурет ашылмады'", async ({ browser }) => {
  // Simulate the production failure mode (file lost from a non-persistent
  // UPLOAD_ROOT) on the photo THIS spec uploaded to the local test server.
  const file = path.join(process.env.E2E_UPLOAD_ROOT ?? path.join(process.cwd(), "public", "uploads"), ...uploadedPhoto.replace("/uploads/", "").split("/"));
  expect(existsSync(file)).toBe(true);
  rmSync(file);

  const child = await as(browser, "child@ecostart.local");
  const res = await child.request.get(uploadedPhoto);
  expect(res.status()).toBe(404);
  expect(res.headers()["x-media-reason"]).toBe("file-missing"); // only for a viewer who IS allowed

  await child.goto("/kk/app/child/ecolab");
  await expect(child.getByRole("img", { name: "Сурет қолжетімсіз" }).first()).toBeVisible();
  await expect(child.getByText("Сурет ашылмады").first()).toBeVisible();
});

test("public news pages still load without a session", async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL });
  const res = await anon.get("/kk/news");
  expect(res.status()).toBe(200);
  await anon.dispose();
});
