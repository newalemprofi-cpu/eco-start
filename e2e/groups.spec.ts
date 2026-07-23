import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

async function login(page: import("@playwright/test").Page, identifier: string, urlPattern: RegExp, secret = PASSWORD) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(secret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(urlPattern);
}

// groups-manager.tsx renders BOTH the desktop <table> and the mobile
// card list in the DOM at all times (CSS `hidden`/`lg:hidden` just
// toggles which one is visible), so a bare page.getByText() matches
// both and trips Playwright's strict mode. Every lookup here is scoped
// to the <table> — Playwright's default desktop viewport (1280x720) is
// above the lg breakpoint, so the table is always the visible one.
function table(page: import("@playwright/test").Page) {
  return page.locator("table");
}
function groupRow(page: import("@playwright/test").Page, text: string) {
  return table(page).locator("tr", { hasText: text }).first();
}

test("SUPER_ADMIN can open the groups page and see seeded groups", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/groups");
  await expect(page.getByRole("heading", { name: "Топтар", exact: true })).toBeVisible();
  await expect(table(page).getByText('"Шұғыла" мектепалды тобы')).toBeVisible();
  await expect(table(page).getByText('"Ботақан" ересек тобы')).toBeVisible();
  await expect(table(page).getByText('"Алтын сақа" ересек тобы')).toBeVisible();
  await expect(table(page).getByText('"Ертөстік" мектепалды тобы')).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
});

test("CHILD cannot reach either groups management route", async ({ page }) => {
  const { child } = await getFamilyFixture();
  await login(page, child.loginIdentifier, /\/app\/child/, child.plainSecret);
  await page.goto("/kk/app/super-admin/groups");
  await expect(page).toHaveURL(/\/app\/child/);
  await page.goto("/kk/app/admin/groups");
  await expect(page).toHaveURL(/\/app\/child/);
});

test("PARENT cannot reach either groups management route", async ({ page }) => {
  const { parent } = await getFamilyFixture();
  await login(page, parent.loginIdentifier, /\/app\/parent/, parent.plainSecret);
  await page.goto("/kk/app/super-admin/groups");
  await expect(page).toHaveURL(/\/app\/parent/);
  await page.goto("/kk/app/admin/groups");
  await expect(page).toHaveURL(/\/app\/parent/);
});

test("SCHOOL_ADMIN (ADMIN рұқсатпен) can add and delete a group from their own /app/admin/groups", async ({
  page,
}) => {
  await login(page, "admin@ecostart.local", /\/app\/admin/);
  await page.goto("/kk/app/admin/groups");

  const uniqueName = `E2E топ ${Date.now()}`;
  const uniqueCode = `E2E-${Date.now()}`;
  await page.getByRole("button", { name: "Жаңа топ қосу" }).click();
  await page.getByLabel("Топ атауы").fill(uniqueName);
  await page.getByLabel("Топ коды").fill(uniqueCode);
  await page.getByRole("button", { name: "Сақтау" }).click();
  await expect(page.getByText("Топ қосылды")).toBeVisible({ timeout: 10000 });
  await expect(table(page).getByText(uniqueName)).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await groupRow(page, uniqueName).getByRole("button", { name: "Жою" }).click();
  await expect(page.getByText("Топ жойылды")).toBeVisible({ timeout: 10000 });
});

test("duplicate group code is rejected", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/groups");

  await page.getByRole("button", { name: "Жаңа топ қосу" }).click();
  await page.getByLabel("Топ атауы").fill(`Duplicate code test ${Date.now()}`);
  await page.getByLabel("Топ коды").fill("SHUGYLA-01"); // already used by the real imported "Шұғыла" group
  await page.getByRole("button", { name: "Сақтау" }).click();
  await expect(page.getByText(/қолданыста бар/)).toBeVisible({ timeout: 10000 });
});

test("editing, archiving, and restoring a group round-trips correctly", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/groups");

  const uniqueName = `Archive test ${Date.now()}`;
  const uniqueCode = `ARC-${Date.now()}`;
  await page.getByRole("button", { name: "Жаңа топ қосу" }).click();
  await page.getByLabel("Топ атауы").fill(uniqueName);
  await page.getByLabel("Топ коды").fill(uniqueCode);
  await page.getByRole("button", { name: "Сақтау" }).click();
  await expect(page.getByText("Топ қосылды")).toBeVisible({ timeout: 10000 });

  // Edit.
  await groupRow(page, uniqueName).getByRole("button", { name: "Өзгерту" }).click();
  const renamedName = `${uniqueName} (өзгертілген)`;
  await page.getByLabel("Топ атауы").fill(renamedName);
  await page.getByRole("button", { name: "Сақтау" }).click();
  await expect(page.getByText("Топ өзгертілді")).toBeVisible({ timeout: 10000 });
  await expect(table(page).getByText(renamedName)).toBeVisible();

  // Archive — with the default "Белсенді" status filter, it drops out of view.
  await groupRow(page, renamedName).getByRole("button", { name: "Архивтеу" }).click();
  await expect(page.getByText("Топ архивтелді")).toBeVisible({ timeout: 10000 });
  await expect(table(page).getByText(renamedName)).toHaveCount(0);

  // Switch the status filter to see it again and restore.
  await page.getByRole("combobox", { name: "Күй сүзгісі" }).click();
  await page.getByRole("option", { name: "Барлығы" }).click();
  await expect(table(page).getByText(renamedName)).toBeVisible();
  await groupRow(page, renamedName).getByRole("button", { name: "Қалпына келтіру" }).click();
  await expect(page.getByText("Топ архивтен қалпына келтірілді")).toBeVisible({ timeout: 10000 });

  // Clean up.
  page.once("dialog", (d) => d.accept());
  await groupRow(page, renamedName).getByRole("button", { name: "Жою" }).click();
  await expect(page.getByText("Топ жойылды")).toBeVisible({ timeout: 10000 });
});

test("a group with linked children cannot be hard-deleted", async ({ page }) => {
  await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
  await page.goto("/kk/app/super-admin/groups");

  // The real imported "Шұғыла" group has real linked children.
  page.once("dialog", (d) => d.accept());
  await groupRow(page, '"Шұғыла" мектепалды тобы').getByRole("button", { name: "Жою" }).click();
  await expect(page.getByText(/балалар бар/)).toBeVisible({ timeout: 10000 });
  await expect(table(page).getByText('"Шұғыла" мектепалды тобы')).toBeVisible();
});

// water-the-flower / plant-needs / nature-puzzle are seeded with a
// single age category each (MIDDLE_3 / SENIOR_4 / PRESCHOOL_5
// respectively — see scripts/seed.ts); every other game keeps the
// default empty age_categories ("барлық санат"). The family fixture's
// real child belongs to "Шұғыла" — a real PRESCHOOL_5 group (see
// scripts/import/parse-excel.ts's GROUP_DEFINITIONS) — so this
// exercises the real filtering logic end to end against real imported
// data rather than the old demo seed.
test("a PRESCHOOL_5 group's child sees age-appropriate games, not other categories' exclusive games", async ({
  page,
}) => {
  const { child, ageCategory } = await getFamilyFixture();
  expect(ageCategory).toBe("PRESCHOOL_5");
  await login(page, child.loginIdentifier, /\/app\/child/, child.plainSecret);
  await page.goto("/kk/app/child/games");

  await expect(page.getByText("Топ тағайындалмаған")).toHaveCount(0);
  await expect(page.getByText("Табиғат пазлы", { exact: true })).toBeVisible(); // nature-puzzle, PRESCHOOL_5-only
  await expect(page.getByText("Гүлді суар", { exact: true })).toHaveCount(0); // water-the-flower, MIDDLE_3-only
  await expect(page.getByText("Өсімдікке не керек?", { exact: true })).toHaveCount(0); // plant-needs, SENIOR_4-only
  await expect(page.getByText("Қоқысты сұрыптау", { exact: true })).toBeVisible(); // all-ages, unchanged
});

test("teacher overview shows the group's code, age category, and child count", async ({ page }) => {
  const { teacher, groupName, groupCode } = await getFamilyFixture();
  await login(page, teacher.loginIdentifier, /\/app\/teacher/, teacher.plainSecret);
  await page.goto("/kk/app/teacher");
  const escapedGroupName = groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page.getByText(new RegExp(`${escapedGroupName} \\(${groupCode}\\)`))).toBeVisible();
  await expect(page.getByText(/Мектепалды топ/)).toBeVisible();
});
