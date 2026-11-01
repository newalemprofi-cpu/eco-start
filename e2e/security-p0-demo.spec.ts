import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * P0 security checks through the real HTTP stack (proxy → routes →
 * DB), with SEEDED DEMO accounts — run only against an isolated,
 * seeded test database, never production. Opt-in: E2E_DEMO=1.
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

let photoUrl = "";

test("a child's uploaded photo gets a guarded /uploads URL", async ({ browser }) => {
  const child = await as(browser, "child@ecostart.local");
  await child.goto("/kk/app/child/ecolab");
  await child.getByLabel("Галереядан таңдау").setInputFiles({ name: "leaf.png", mimeType: "image/png", buffer: PNG });
  await child.getByRole("button", { name: "Иә, тексер!" }).click();
  await child.getByRole("link", { name: /Толығырақ/ }).click({ timeout: 15000 });
  await child.waitForURL(/\/ecolab\/[0-9a-f-]{36}$/); // not the upload preview's blob: URL
  photoUrl = (await child.locator("main img").first().getAttribute("src")) ?? "";
  expect(photoUrl).toMatch(/^\/uploads\/recognitions\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/\d+\.png$/);
  // The page itself can display it (same-origin request with the session cookie).
  const own = await child.request.get(photoUrl);
  expect(own.status()).toBe(200);
  expect(own.headers()["cache-control"]).toContain("private");
  expect(own.headers()["cache-control"]).toContain("no-store");
});

test("anonymous requests are refused, including encoded/re-cased path tricks", async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL });
  expect((await anon.get(photoUrl)).status()).toBe(401);
  expect((await anon.get(photoUrl.replace("/uploads/recognitions/", "/uploads/%72ecognitions/"))).status()).toBe(401);
  expect([401, 404]).toContain((await anon.get(photoUrl.replace("/uploads/recognitions/", "/uploads/Recognitions/"))).status());
  // The direct API path is guarded too.
  expect((await anon.get(photoUrl.replace("/uploads/", "/api/media/"))).status()).toBe(401);
  await anon.dispose();
});

test("only the owner, their teacher, linked parent and school admin can open it", async ({ browser }) => {
  const allowed = ["teacher@ecostart.local", "parent@ecostart.local", "admin@ecostart.local"];
  for (const who of allowed) {
    const page = await as(browser, who);
    expect((await page.request.get(photoUrl)).status(), who).toBe(200);
  }
  // Classmate (IDOR on the URL) — 404, indistinguishable from "no such file".
  const classmate = await as(browser, "demo-child-2");
  expect((await classmate.request.get(photoUrl)).status()).toBe(404);
});

test("child PIN brute force: locked after 5 wrong PINs, then even the right PIN is refused", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await login(page, "demo-child-3", `00${i}0`);
    await expect(page.locator("p[role=alert]")).toBeVisible();
  }
  await expect(page.locator("p[role=alert]")).toContainText("минуттан кейін");
  await login(page, "demo-child-3", PASSWORD);
  await expect(page.locator("p[role=alert]")).toContainText("Тым көп әрекет");
  await expect(page).toHaveURL(/\/login/);
});

test("unknown login codes are throttled the same way (no account enumeration)", async ({ page }) => {
  const ghost = `ghost-${Date.now()}`;
  for (let i = 0; i < 4; i++) {
    await login(page, ghost, "1234");
    await expect(page.locator("p[role=alert]")).toContainText("қате");
  }
  await login(page, ghost, "1234");
  await expect(page.locator("p[role=alert]")).toContainText("Тым көп әрекет");
});
