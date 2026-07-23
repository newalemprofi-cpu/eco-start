import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

async function login(page: import("@playwright/test").Page, identifier: string, secret: string, urlPattern: RegExp) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(secret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(urlPattern);
}

test("the platform is Kazakh-only: /ru and /en redirect to /kk, no locale switcher", async ({ page }) => {
  await page.goto("/kk");
  const kkBody = await page.locator("body").innerText();
  expect(kkBody).toContain("Бала"); // kk role label present
  expect(kkBody).not.toMatch(/\bРУС\b|\bENG\b/); // old locale-switcher labels gone
  await expect(page.getByRole("button", { name: /^ҚАЗ$|^РУС$|^ENG$/ })).toHaveCount(0);

  await page.goto("/ru");
  await expect(page).toHaveURL(/\/kk$/);

  await page.goto("/en/login");
  await expect(page).toHaveURL(/\/kk\/login$/);
});

// The three tests that used to live here (section-draft-not-public,
// module-disable-publish, media-upload-rejection) all exercised the
// SUPER_ADMIN "Бастапқы бет мазмұны" admin UI, which this session
// removed entirely (see cms-admin-ui.spec.ts's 404 test) — the
// underlying cms.ts repo functions/tables are untouched and still power
// the public homepage, but there is no admin route left to drive them
// through a browser, so those tests were removed rather than adapted.

test("no visible 'Мұғалім' or 'Мектеп' terminology on public/child/teacher/parent/admin pages", async ({ page }) => {
  // "Мектепалды топ" (spec-mandated PRESCHOOL_5 age-category label, see
  // groups module) is a legitimate compound alongside the pre-existing
  // "Мектепке дейінгі" allowance — both mean "preschool", neither is the
  // generic bureaucratic "Мектеп" usage this check guards against.
  const forbidden = /Мұғалім|Мектеп(?!ке дейінгі|алды)/;

  await page.goto("/kk");
  expect(await page.locator("body").innerText()).not.toMatch(forbidden);

  const { teacher } = await getFamilyFixture();
  await login(page, teacher.loginIdentifier, teacher.plainSecret, /\/app\/teacher/);
  expect(await page.locator("body").innerText()).not.toMatch(forbidden);

  await page.goto("/kk/app/teacher/ai-studio");
  expect(await page.locator("body").innerText()).not.toMatch(forbidden);
});
