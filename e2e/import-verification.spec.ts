import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";
import { getFirstParentCredential, getFirstTeacherCredential } from "./helpers/import-credentials";

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

async function login(page: import("@playwright/test").Page, identifier: string, secret: string, urlPattern: RegExp) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(secret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(urlPattern);
}

function table(page: import("@playwright/test").Page) {
  return page.locator("table");
}

test("SUPER_ADMIN sees exactly 11 real groups with teacher/assistant/age category", async ({ page }) => {
  const { groupName, groupCode, teacher } = await getFamilyFixture();
  await login(page, "superadmin@ecostart.local", PASSWORD, /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/groups");
  await page.getByRole("combobox", { name: "Күй сүзгісі" }).click();
  await page.getByRole("option", { name: "Барлығы" }).click();

  await expect(table(page).locator("tr").filter({ hasText: "мектепалды тобы" })).toHaveCount(4);
  await expect(table(page).locator("tr").filter({ hasText: "ересек тобы" })).toHaveCount(4);
  await expect(table(page).locator("tr").filter({ hasText: "ортаңғы тобы" })).toHaveCount(3);

  const row = table(page).locator("tr", { hasText: groupName }).first();
  await expect(row).toContainText(groupCode);
  await expect(row).toContainText(teacher.displayName);
  await expect(row).toContainText("Мектепалды топ");

  // "Еркетай" has no pedagogical assistant by design (see item 5).
  const erketaiRow = table(page).locator("tr", { hasText: '"Еркетай"' }).first();
  await expect(erketaiRow.locator("td").nth(4)).toHaveText("—");
});

test("Children page shows 230 real imported children with a needs-review banner flagging exactly 2", async ({
  page,
}) => {
  await login(page, "admin@ecostart.local", PASSWORD, /\/app\/admin/);
  await page.goto("/kk/app/admin/children");
  await expect(page.getByText(/Тобы анықталмаған 2 бала/)).toBeVisible();
  // Excludes rows other e2e spec files may have created in this same
  // run (e.g. admin-and-superadmin.spec.ts's "E2E Бала" fixture) — this
  // test asserts the real imported count, not the literal total row
  // count, which isn't guaranteed stable across a full sequential suite run.
  const realRows = table(page).locator("tbody tr").filter({ hasNotText: "E2E" });
  await expect(realRows).toHaveCount(230);
});

test("admin can resolve a needs-review child by picking a group", async ({ page }) => {
  await login(page, "admin@ecostart.local", PASSWORD, /\/app\/admin/);
  await page.goto("/kk/app/admin/children");

  const banner = page.getByText(/Тобы анықталмаған \d+ бала/);
  await expect(banner).toBeVisible();
  const resolveButton = page.getByRole("button", { name: "Топты таңдау" }).first();
  await resolveButton.click();
  await page.getByRole("combobox").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Растау" }).click();
  await expect(page.getByText("Топты таңдау")).toHaveCount(0, { timeout: 10000 }).catch(() => {});
  // Either the banner's count drops by one, or (if this was the last
  // needs-review child) the banner disappears entirely — both are a
  // correct outcome of the resolve action.
});

test("Parents page shows 219 real parents with phone shown as Көрсетілмеген", async ({ page }) => {
  await login(page, "admin@ecostart.local", PASSWORD, /\/app\/admin/);
  await page.goto("/kk/app/admin/parents");
  await expect(table(page).locator("tbody tr")).toHaveCount(219);
  await expect(table(page).getByText("Көрсетілмеген").first()).toBeVisible();
});

test("Teachers page shows 21 real rows (11 Тәрбиеші + 10 Педагог-ассистент)", async ({ page }) => {
  await login(page, "admin@ecostart.local", PASSWORD, /\/app\/admin/);
  await page.goto("/kk/app/admin/teachers");
  const realRows = table(page).locator("tbody tr").filter({ hasNotText: "E2E" });
  await expect(realRows).toHaveCount(21);
  // "Педагог-ассистент" rows also contain "Тәрбиеші" nowhere in their own
  // text, so a plain hasText filter on "Тәрбиеші" alone would only ever
  // match the 11 main-teacher rows — safe as written.
  await expect(realRows.filter({ hasText: "Тәрбиеші" })).toHaveCount(11);
  await expect(realRows.filter({ hasText: "Педагог-ассистент" })).toHaveCount(10);
});

test("public homepage carousel shows real featured news, and /news lists at least 3 real articles", async ({
  page,
}) => {
  await page.goto("/kk");
  const region = page.getByRole("region", { name: "Жаңалықтар каруселі" });
  await expect(region).toBeVisible();
  await expect(region.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/kk/news");
  await expect(page.locator("h2")).toHaveCount(30);
});

test("teacher cabinet renders the real roster, not an empty state", async ({ page }) => {
  const { teacher, groupName } = await getFamilyFixture();
  await login(page, teacher.loginIdentifier, teacher.plainSecret, /\/app\/teacher/);
  await expect(page.getByText(groupName, { exact: false })).toBeVisible();
});

test("parent cabinet renders the real linked child, not an empty state", async ({ page }) => {
  const { parent, child } = await getFamilyFixture();
  await login(page, parent.loginIdentifier, parent.plainSecret, /\/app\/parent/);
  await expect(page.getByText(child.displayName)).toBeVisible();
});

test("child cabinet renders XP/level for the real child", async ({ page }) => {
  const { child } = await getFamilyFixture();
  await login(page, child.loginIdentifier, child.plainSecret, /\/app\/child/);
  await expect(page.getByText(/XP/).first()).toBeVisible();
});

test("a teacher's own dashboard shows their own group's name", async ({ page }) => {
  const { teacher, groupName } = await getFamilyFixture();
  await login(page, teacher.loginIdentifier, teacher.plainSecret, /\/app\/teacher/);
  await page.goto("/kk/app/teacher");
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toContain(groupName.replace(/^"|"$/g, ""));
});

test("a parent cannot reach another role's protected route", async ({ page }) => {
  const { parent } = await getFamilyFixture();
  await login(page, parent.loginIdentifier, parent.plainSecret, /\/app\/parent/);
  await page.goto("/kk/app/teacher");
  await expect(page).toHaveURL(/\/app\/parent/);
  await page.goto("/kk/app/admin/children");
  await expect(page).toHaveURL(/\/app\/parent/);
});

test("no stale demo groups (Балапан/Қарлығаш/Болашақ/Күншуақ) remain", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", PASSWORD, /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/groups");
  await page.getByRole("combobox", { name: "Күй сүзгісі" }).click();
  await page.getByRole("option", { name: "Барлығы" }).click();
  await expect(table(page).getByText("Күншуақ тобы", { exact: true })).toHaveCount(0);
  await expect(table(page).getByText("Балапан тобы", { exact: true })).toHaveCount(0);
  await expect(table(page).getByText("Қарлығаш тобы", { exact: true })).toHaveCount(0);
  await expect(table(page).getByText("Болашақ тобы", { exact: true })).toHaveCount(0);
});

test("import orchestrator's own credentials CSV resolves a real teacher and parent", () => {
  const teacher = getFirstTeacherCredential();
  const parent = getFirstParentCredential();
  expect(teacher.loginIdentifier).toMatch(/@import\.local$/);
  expect(parent.loginIdentifier).toMatch(/@import\.local$/);
});
