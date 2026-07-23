import { expect, test, type Locator, type Page } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

// Matches GameResultScreen's "+{xp} XP" text — distinct from the
// "⭐ x/y" history footer, which can already be on the page from
// seeded history before a round is actually complete.
const XP_REGEX = /\+\d+ XP/;

async function loginChild(page: Page) {
  const { child } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(child.loginIdentifier);
  await page.locator('input[type="password"]').fill(child.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/child/);
}

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

async function resultVisible(page: Page): Promise<boolean> {
  return page.getByText(XP_REGEX).first().isVisible().catch(() => false);
}

/**
 * @dnd-kit's PointerSensor needs real incremental pointermove events
 * past its activation distance (6px) before it recognizes a drag —
 * Playwright's built-in `locator.dragTo()` doesn't reliably produce
 * enough of them and hangs. This does a real mouse down → many small
 * moves → up, which is what actually exercises the app the way a
 * human drag would (verified manually before writing this: a single
 * such drag correctly triggered a wrong-zone bounce-back with the
 * "try again" mascot phrase).
 */
async function manualDrag(page: Page, source: Locator, target: Locator): Promise<boolean> {
  // The item grid can be taller than the viewport (e.g. a 6-tile
  // drag_collect round wraps to 2 rows) — without this, boundingBox()
  // still returns page coordinates for an off-screen row, and raw
  // page.mouse events at those coordinates hit nothing (verified via
  // document.elementFromPoint returning null), so the drag silently
  // never starts. locator.dragTo() and .click() auto-scroll; raw
  // page.mouse doesn't, so it has to be done explicitly here.
  await source.scrollIntoViewIfNeeded().catch(() => {});
  const sourceBox = await source.boundingBox().catch(() => null);
  const targetBox = await target.boundingBox().catch(() => null);
  if (!sourceBox || !targetBox) return false;
  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + ((endX - startX) * i) / steps, startY + ((endY - startY) * i) / steps);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(650);
  return true;
}

/** drag_sort: one current item at a time, all zones visible — cycle
 * the same item through zones until it settles (advances) or the
 * round completes. */
async function playSettleUntilCorrectSingle(page: Page, maxItems = 8) {
  for (let item = 0; item < maxItems; item++) {
    if (await resultVisible(page)) return;
    const draggable = page.getByTestId(/^draggable-/).first();
    if (!(await draggable.isVisible().catch(() => false))) {
      await page.waitForTimeout(500);
      continue;
    }
    const zones = page.getByTestId(/^dropzone-/);
    const zoneCount = await zones.count();
    for (let z = 0; z < zoneCount; z++) {
      if (await resultVisible(page)) return;
      const testId = await draggable.getAttribute("data-testid").catch(() => null);
      await manualDrag(page, draggable, zones.nth(z));
      const stillSameItem = testId ? await page.getByTestId(testId).isVisible().catch(() => false) : false;
      if (!stillSameItem) break; // advanced to the next item (or finished)
    }
  }
}

/** drag_collect: several draggables at once (some distractors that
 * always bounce back — that's correct, "no fail" behavior, not a bug),
 * one zone — cycle through the still-draggable (not yet placed) ones
 * round-robin. Placed tiles keep their data-testid (DraggableTile
 * doesn't unmount them) but pick up an "opacity-70" class and drop
 * their dnd-kit listeners, so filter on that class rather than on
 * disabled/aria-disabled, which DraggableTile never sets. */
async function playDragCollect(page: Page, maxAttempts = 30) {
  const zone = page.getByTestId("dropzone-zone");
  for (let i = 0; i < maxAttempts; i++) {
    if (await resultVisible(page)) return;
    const draggables = page.locator('[data-testid^="draggable-"]:not(.opacity-70)');
    const count = await draggables.count();
    if (count === 0) {
      await page.waitForTimeout(500);
      continue;
    }
    await manualDrag(page, draggables.nth(i % count), zone);
  }
}

/** puzzle_assemble: several pieces, several slots, one correct slot
 * per piece — sweep every piece against every slot. */
async function playPuzzle(page: Page, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await resultVisible(page)) return;
    const pieces = page.getByTestId(/^draggable-/);
    const slots = page.getByTestId(/^dropzone-/);
    const pieceCount = await pieces.count();
    const slotCount = await slots.count();
    if (pieceCount === 0 || slotCount === 0) {
      await page.waitForTimeout(500);
      continue;
    }
    const pieceIdx = i % pieceCount;
    const slotIdx = Math.floor(i / pieceCount) % slotCount;
    await manualDrag(page, pieces.nth(pieceIdx), slots.nth(slotIdx));
  }
}

/** Tap-based rounds (quiz_match / sequence_order options) — clicks
 * are wrapped so a mid-transition "element detached" doesn't fail the
 * whole test; the loop just retries with a freshly-queried element. */
async function tapLoop(page: Page, selector: string, iterations: number, waitMs: number) {
  for (let i = 0; i < iterations; i++) {
    if (await resultVisible(page)) return;
    const tile = page.locator(selector).first();
    if (!(await tile.isVisible({ timeout: 2000 }).catch(() => false))) continue;
    await tile.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(waitMs);
  }
}

const TILE_SELECTOR = "button.rounded-\\[2rem\\]:not([disabled])";

test.describe("all 15 EcoGame games — no console errors, playable end to end", () => {
  test("games hub renders age-appropriate games with icons and no errors", async ({ page }) => {
    // The family fixture's real child is in "Шұғыла" (PRESCHOOL_5).
    // scripts/seed.ts tags 3 of the 15 games with a single exclusive age
    // category each (water-the-flower/MIDDLE_3, plant-needs/SENIOR_4,
    // nature-puzzle/PRESCHOOL_5) to demonstrate the groups module's
    // age-category content filtering (src/db/repo/games.ts's
    // listGames) — so a PRESCHOOL_5 child now correctly sees 13 of the
    // 15 (12 unrestricted + nature-puzzle), not all 15.
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games");
    await page.waitForTimeout(500);
    await expect(page.locator("a.group")).toHaveCount(13);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("1. waste-sorting (drag_sort, dedicated route) — real drag, reaches result screen", async ({ page }) => {
    test.setTimeout(60000);
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/waste-sorting");
    await page.waitForTimeout(600);
    await playSettleUntilCorrectSingle(page);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("2. plant-a-tree (sequence_order) — tap tiles, reaches result screen", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/plant-a-tree");
    await page.waitForTimeout(600);
    await tapLoop(page, TILE_SELECTOR, 6, 250);
    await page.waitForTimeout(1200);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("3. water-the-flower (nurture) — repeated tap grows the flower to completion", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/water-the-flower");
    await page.waitForTimeout(600);
    await tapLoop(page, "button.animate-pulse", 6, 350);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("4. grow-a-tree (nurture) — repeated tap grows the tree to completion", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/grow-a-tree");
    await page.waitForTimeout(600);
    await tapLoop(page, "button.animate-pulse", 6, 350);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("5. help-the-bees (drag_collect) — real drag onto the bee zone", async ({ page }) => {
    test.setTimeout(60000);
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/help-the-bees");
    await page.waitForTimeout(600);
    await playDragCollect(page);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("6. clean-the-river (drag_collect) — real drag onto the trash zone", async ({ page }) => {
    test.setTimeout(60000);
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/clean-the-river");
    await page.waitForTimeout(600);
    await playDragCollect(page);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("7. animal-homes (drag_sort) — real drag to matching home", async ({ page }) => {
    test.setTimeout(60000);
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/animal-homes");
    await page.waitForTimeout(600);
    await playSettleUntilCorrectSingle(page);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("8. plant-needs (quiz_match, picture-only options)", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/plant-needs");
    await page.waitForTimeout(600);
    await tapLoop(page, TILE_SELECTOR, 5, 1000);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("9. catch-fruits (catch) — tap to catch within the timer", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/catch-fruits");
    await page.waitForTimeout(600);
    for (let i = 0; i < 9; i++) {
      if (await resultVisible(page)) break;
      const catchButton = page.getByRole("button", { name: "catch" });
      if (!(await catchButton.isVisible().catch(() => false))) break;
      await catchButton.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("10. color-hunt (click_target) — select-then-confirm", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/color-hunt");
    await page.waitForTimeout(600);
    for (let round = 0; round < 4; round++) {
      if (await resultVisible(page)) break;
      const tile = page.locator(TILE_SELECTOR).first();
      if (await tile.isVisible().catch(() => false)) await tile.click({ timeout: 3000 }).catch(() => {});
      const ok = page.getByRole("button", { name: "OK" });
      if (await ok.isVisible().catch(() => false)) await ok.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("11. recycling-factory (drag_sort) — real drag into bins", async ({ page }) => {
    test.setTimeout(60000);
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/recycling-factory");
    await page.waitForTimeout(600);
    await playSettleUntilCorrectSingle(page);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("12. nature-puzzle (puzzle_assemble) — real drag pieces into slots", async ({ page }) => {
    test.setTimeout(60000);
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/nature-puzzle");
    await page.waitForTimeout(600);
    await playPuzzle(page);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("13. nature-sounds (sound_match) — play + tap matching picture", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/nature-sounds");
    await page.waitForTimeout(600);
    await tapLoop(page, TILE_SELECTOR, 5, 1000);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("14. odd-one-out (click_target) — select-then-confirm", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/odd-one-out");
    await page.waitForTimeout(600);
    for (let round = 0; round < 4; round++) {
      if (await resultVisible(page)) break;
      const tile = page.locator(TILE_SELECTOR).first();
      if (await tile.isVisible().catch(() => false)) await tile.click({ timeout: 3000 }).catch(() => {});
      const ok = page.getByRole("button", { name: "OK" });
      if (await ok.isVisible().catch(() => false)) await ok.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("15. eco-quest (quiz_match, map-skinned) — playable end to end", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await loginChild(page);
    await page.goto("/kk/app/child/games/eco-quest");
    await page.waitForTimeout(600);
    await tapLoop(page, TILE_SELECTOR, 5, 1000);
    await expect(page.getByText(XP_REGEX).first()).toBeVisible({ timeout: 15000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
