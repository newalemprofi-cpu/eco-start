import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

async function loginChild(page: import("@playwright/test").Page) {
  const { child } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(child.loginIdentifier);
  await page.locator('input[type="password"]').fill(child.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/child/);
}

test("child can add a greenhouse plant and log growth", async ({ page }) => {
  // The add-plant dialog is tap-only (no free-text input) by design —
  // preschoolers can't reliably type — so this picks the first preset
  // nickname/watering-schedule chip rather than filling a text field.
  await loginChild(page);
  await page.goto("/kk/app/child/greenhouse");
  await page.getByRole("button", { name: "Жаңа өсімдік қосу" }).click();
  await page.getByRole("button", { name: "🌻" }).click();
  await page.getByRole("button", { name: "💧💧" }).click();
  await page.getByRole("button", { name: "Сақтау" }).click();
  // Newly planted entries default planted_at = now() and the list
  // sorts by planted_at desc, so the just-created plant is always
  // first — not last — regardless of how many prior runs accumulated.
  const newPlant = page.getByText("Күнбағысым", { exact: true }).first();
  await expect(newPlant).toBeVisible({ timeout: 10000 });

  await newPlant.click();
  await expect(page).toHaveURL(/greenhouse\/[a-f0-9-]+/);
  await page.getByLabel("Биіктігі (см)").fill("12.5");
  await page.getByRole("button", { name: "Бақылау қосу" }).click();
  await expect(page.getByText("12.5 cm")).toBeVisible({ timeout: 10000 });
});

// Waste sorting is drag-and-drop (dnd-kit), not tap-a-bin-button — see
// the preschool redesign. locator.dragTo() doesn't reliably trigger
// dnd-kit's PointerSensor, so this drives real incremental pointer
// events instead (same technique as e2e/ecogame-all-15.spec.ts).
async function manualDrag(page: import("@playwright/test").Page, source: import("@playwright/test").Locator, target: import("@playwright/test").Locator) {
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) return;
  const startX = s.x + s.width / 2, startY = s.y + s.height / 2;
  const endX = t.x + t.width / 2, endY = t.y + t.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(startX + ((endX - startX) * i) / 10, startY + ((endY - startY) * i) / 10);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(650);
}

test("child can play the waste sorting game and earn XP", async ({ page }) => {
  test.setTimeout(60000);
  await loginChild(page);
  await page.goto("/kk/app/child/games/waste-sorting");
  await page.waitForTimeout(600);

  for (let item = 0; item < 8; item++) {
    if (await page.getByText(/\+\d+ XP/).first().isVisible().catch(() => false)) break;
    const draggable = page.getByTestId(/^draggable-/).first();
    if (!(await draggable.isVisible().catch(() => false))) {
      await page.waitForTimeout(500);
      continue;
    }
    const zones = page.getByTestId(/^dropzone-/);
    const zoneCount = await zones.count();
    for (let z = 0; z < zoneCount; z++) {
      if (await page.getByText(/\+\d+ XP/).first().isVisible().catch(() => false)) break;
      const testId = await draggable.getAttribute("data-testid").catch(() => null);
      await manualDrag(page, draggable, zones.nth(z));
      const stillSameItem = testId ? await page.getByTestId(testId).isVisible().catch(() => false) : false;
      if (!stillSameItem) break;
    }
  }
  await expect(page.getByText(/\+\d+ XP/).first()).toBeVisible({ timeout: 15000 });
});
