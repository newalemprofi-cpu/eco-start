import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

test("/kk/login loads with no PostgresError / console errors", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") messages.push(m.text());
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));

  const response = await page.goto("/kk/login", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);

  const pgErrors = messages.filter((m) => /PostgresError|password authentication failed/i.test(m));
  expect(pgErrors, messages.join("\n")).toHaveLength(0);
  await expect(page.getByRole("heading", { name: "Жүйеге кіру" })).toBeVisible();
});

test("logging in as each role succeeds — exercises the app_user DB connection end to end", async ({ page }) => {
  const { teacher, parent, child } = await getFamilyFixture();
  for (const { identifier, secret } of [
    { identifier: "superadmin@ecostart.local", secret: PASSWORD },
    { identifier: "admin@ecostart.local", secret: PASSWORD },
    { identifier: teacher.loginIdentifier, secret: teacher.plainSecret },
    { identifier: parent.loginIdentifier, secret: parent.plainSecret },
    { identifier: child.loginIdentifier, secret: child.plainSecret },
  ]) {
    await page.goto("/kk/login");
    await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
    await page.locator('input[type="password"]').fill(secret);
    await page.getByRole("button", { name: "Кіру" }).click();
    await page.waitForURL(/\/app\//, { timeout: 10000 });
    // Log back out for the next iteration.
    await page.getByRole("button", { name: /Шығу/ }).click();
    await page.waitForURL(/\/login/);
  }
});
