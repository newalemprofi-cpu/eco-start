import { expect, test } from "@playwright/test";
import { getFamilyFixture } from "./helpers/family-fixture";

function collectConsole(page: import("@playwright/test").Page) {
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") messages.push(m.text());
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  return messages;
}

// Navigational elements (login CTA, certificate download) are plain
// <Link>/<a> styled with buttonVariants() rather than <Button
// render={<Link/>}>. That avoids two problems at once: Base UI's
// nativeButton console warning (it doesn't apply — there's no
// ButtonPrimitive involved), and a subtler one: Base UI's Button always
// sets role="button" on whatever it renders regardless of nativeButton,
// which silently breaks role="link" queries / assistive-tech semantics
// for things that are actually links. See git history for the ARIA
// role regression this replaced.

test("no Base UI nativeButton warnings on /kk/login", async ({ page }) => {
  const messages = collectConsole(page);
  await page.goto("/kk/login", { waitUntil: "networkidle" });
  const nativeButtonWarnings = messages.filter((m) => m.includes("nativeButton"));
  expect(nativeButtonWarnings, messages.join("\n")).toHaveLength(0);
});

test("landing page CTAs are real links (role=link), not Base UI buttons", async ({ page }) => {
  const messages = collectConsole(page);
  await page.goto("/kk", { waitUntil: "networkidle" });
  const nativeButtonWarnings = messages.filter((m) => m.includes("nativeButton"));
  expect(nativeButtonWarnings, messages.join("\n")).toHaveLength(0);

  // Header "login" CTA and the hero news carousel's "Толығырақ оқу" CTA
  // must be real <a> links — the hero is now the news carousel (see
  // news-carousel.tsx), so its CTA points at a news article, not /login;
  // this checks the link/href shape rather than hardcoding banner text.
  await expect(page.getByRole("link", { name: "Кіру", exact: true })).toHaveAttribute(
    "href",
    /\/login$/
  );
  await expect(page.locator('main a[href^="/kk/news/"]').first()).toBeVisible();
});

test("child passport certificate download is a real link and downloads a file", async ({ page }) => {
  const { child } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(child.loginIdentifier);
  await page.locator('input[type="password"]').fill(child.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/child/);

  const messages = collectConsole(page);
  await page.goto("/kk/app/child/passport", { waitUntil: "networkidle" });
  const nativeButtonWarnings = messages.filter((m) => m.includes("nativeButton"));
  expect(nativeButtonWarnings, messages.join("\n")).toHaveLength(0);

  const link = page.getByRole("link", { name: /Жүктеп алу/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /\/api\/certificates\//);
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), link.click()]);
  expect(download.suggestedFilename()).toMatch(/certificate-.*\.pdf/);
});

test("parent passport certificate download is a real link and downloads a file", async ({ page }) => {
  const { parent } = await getFamilyFixture();
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(parent.loginIdentifier);
  await page.locator('input[type="password"]').fill(parent.plainSecret);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(/\/app\/parent/);

  const messages = collectConsole(page);
  await page.goto("/kk/app/parent/passport", { waitUntil: "networkidle" });
  const nativeButtonWarnings = messages.filter((m) => m.includes("nativeButton"));
  expect(nativeButtonWarnings, messages.join("\n")).toHaveLength(0);

  const link = page.getByRole("link", { name: /Жүктеп алу/ });
  await expect(link).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), link.click()]);
  expect(download.suggestedFilename()).toMatch(/certificate-.*\.pdf/);
});
