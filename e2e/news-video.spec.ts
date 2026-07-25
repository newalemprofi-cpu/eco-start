import { expect, test } from "@playwright/test";

const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "EcoStart2026!";

async function login(page: import("@playwright/test").Page, identifier: string, urlPattern: RegExp) {
  await page.goto("/kk/login");
  await page.getByPlaceholder("мысалы, teacher@ecostart.local").fill(identifier);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Кіру" }).click();
  await page.waitForURL(urlPattern);
}

// A minimal placeholder buffer is enough here — the upload/validation/
// storage/DB-round-trip pipeline under test only inspects file.type,
// file.name, and file.size (see validateVideoUpload), never decodes
// the video itself. Real playability isn't something a headless
// Playwright run can meaningfully assert on anyway.
const FAKE_VIDEO = Buffer.from("fake mp4 bytes for upload-pipeline testing, not a real video");

test.describe("News video support (admin upload, save/load, public rendering, Range serving)", () => {
  test("admin can upload a main video and an additional video, save, publish, and see them again after reload", async ({
    page,
  }) => {
    await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
    await page.goto("/kk/app/super-admin/news");

    const countBefore = await page.locator('[data-testid^="news-card-"]').count();
    await page.getByRole("button", { name: "Жаңа жаңалық қосу" }).click();
    await expect(page.locator('[data-testid^="news-card-"]')).toHaveCount(countBefore + 1, { timeout: 10000 });

    const newCard = page.locator('[data-testid^="news-card-"]').last();
    const uniqueTitle = `Видео жаңалық ${Date.now()}`;
    const uniqueSlug = `video-news-${Date.now()}`;
    await newCard.locator('input[id^="title-"]').fill(uniqueTitle);
    await newCard.locator('input[id^="slug-"]').fill(uniqueSlug);

    // Main video.
    await newCard.getByText("Видео жүктеу").locator("..").locator('input[type="file"]').setInputFiles({
      name: "main.mp4",
      mimeType: "video/mp4",
      buffer: FAKE_VIDEO,
    });
    await expect(newCard.locator("video").first()).toBeVisible({ timeout: 10000 });

    // Additional video (the "+" video upload tile).
    const videoInputs = newCard.locator('input[type="file"][accept*="video"]');
    await expect(videoInputs).toHaveCount(2); // main + gallery-video tile
    await videoInputs.nth(1).setInputFiles({
      name: "extra.webm",
      mimeType: "video/webm",
      buffer: FAKE_VIDEO,
    });
    await expect(newCard.locator("video")).toHaveCount(2, { timeout: 10000 });

    await newCard.getByRole("button", { name: "Жоба нұсқасын сақтау" }).click();
    await expect(page.getByText("Жоба нұсқасы сақталды")).toBeVisible({ timeout: 10000 });

    // Reload from the server entirely — proves the videos round-tripped
    // through saveNewsDraft -> Postgres (main_video_url/video_urls) and
    // back out through listDraftNews, not just client-side React state.
    await page.reload();
    const reloadedCard = page.locator('[data-testid^="news-card-"]').filter({ hasText: uniqueTitle }).first();
    await expect(reloadedCard.locator("video")).toHaveCount(2, { timeout: 10000 });

    await reloadedCard.getByRole("button", { name: "Жариялау", exact: true }).click();
    await expect(page.getByText("Жарияланды")).toBeVisible({ timeout: 10000 });

    // Public article page: real <video> player with the required attributes.
    await page.goto(`/kk/news/${uniqueSlug}`);
    const mainVideo = page.locator("video").first();
    await expect(mainVideo).toBeVisible();
    await expect(mainVideo).toHaveAttribute("controls", "");
    await expect(mainVideo).toHaveAttribute("preload", "metadata");
    await expect(mainVideo).not.toHaveAttribute("autoplay", /.*/);
    const srcAttr = await mainVideo.getAttribute("src");
    expect(srcAttr).toMatch(/^\/uploads\/site-media\/news\/videos\/.+\.mp4$/);

    // Additional video renders too.
    await expect(page.locator("video")).toHaveCount(2);

    // Clean up so the suite's article-count-based tests elsewhere stay stable.
    await page.goto("/kk/app/super-admin/news");
    const cleanupCard = page.locator('[data-testid^="news-card-"]').filter({ hasText: uniqueTitle }).first();
    page.once("dialog", (d) => d.accept());
    await cleanupCard.getByRole("button", { name: "Жою" }).click();
    await expect(page.getByText("Жаңалық жойылды")).toBeVisible({ timeout: 10000 });
  });

  test("uploaded video is served with Range support (206 partial, correct headers) and rejects an unsatisfiable range with 416", async ({
    page,
    request,
  }) => {
    await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
    await page.goto("/kk/app/super-admin/news");

    const countBefore = await page.locator('[data-testid^="news-card-"]').count();
    await page.getByRole("button", { name: "Жаңа жаңалық қосу" }).click();
    await expect(page.locator('[data-testid^="news-card-"]')).toHaveCount(countBefore + 1, { timeout: 10000 });
    const newCard = page.locator('[data-testid^="news-card-"]').last();

    await newCard.getByText("Видео жүктеу").locator("..").locator('input[type="file"]').setInputFiles({
      name: "range-test.mp4",
      mimeType: "video/mp4",
      buffer: FAKE_VIDEO,
    });
    await expect(newCard.locator("video").first()).toBeVisible({ timeout: 10000 });
    const videoUrl = await newCard.locator("video").first().getAttribute("src");
    expect(videoUrl).toBeTruthy();

    // Full request: 200, Accept-Ranges advertised, correct Content-Type.
    const full = await request.get(videoUrl!);
    expect(full.status()).toBe(200);
    expect(full.headers()["accept-ranges"]).toBe("bytes");
    expect(full.headers()["content-type"]).toBe("video/mp4");

    // Partial request: 206, correct Content-Range/Content-Length, body is exactly the requested slice.
    const partial = await request.get(videoUrl!, { headers: { Range: "bytes=0-9" } });
    expect(partial.status()).toBe(206);
    expect(partial.headers()["content-range"]).toBe(`bytes 0-9/${FAKE_VIDEO.length}`);
    expect(partial.headers()["content-length"]).toBe("10");
    const partialBody = await partial.body();
    expect(partialBody.length).toBe(10);
    expect(partialBody.equals(FAKE_VIDEO.subarray(0, 10))).toBe(true);

    // Unsatisfiable request: 416 with Content-Range: bytes */<size>.
    const unsatisfiable = await request.get(videoUrl!, {
      headers: { Range: `bytes=${FAKE_VIDEO.length + 100}-${FAKE_VIDEO.length + 200}` },
    });
    expect(unsatisfiable.status()).toBe(416);
    expect(unsatisfiable.headers()["content-range"]).toBe(`bytes */${FAKE_VIDEO.length}`);

    // HEAD mirrors GET's headers without a body.
    const head = await request.head(videoUrl!);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-length"]).toBe(String(FAKE_VIDEO.length));

    // Clean up.
    await page.goto("/kk/app/super-admin/news");
    page.once("dialog", (d) => d.accept());
    await newCard.getByRole("button", { name: "Жою" }).click();
    await expect(page.getByText("Жаңалық жойылды")).toBeVisible({ timeout: 10000 });
  });

  test("rejects an unsupported video format with a clear Kazakh error and does not disturb existing image upload", async ({
    page,
  }) => {
    await login(page, "superadmin@ecostart.local", /\/app\/super-admin/);
    await page.goto("/kk/app/super-admin/news");

    const countBefore = await page.locator('[data-testid^="news-card-"]').count();
    await page.getByRole("button", { name: "Жаңа жаңалық қосу" }).click();
    await expect(page.locator('[data-testid^="news-card-"]')).toHaveCount(countBefore + 1, { timeout: 10000 });
    const newCard = page.locator('[data-testid^="news-card-"]').last();

    // Existing image upload still works unaffected.
    await newCard.getByText("Сурет жүктеу").locator("..").locator('input[type="file"]').setInputFiles({
      name: "photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 0, 0, 0]),
    });
    await expect(newCard.locator("img").first()).toBeVisible({ timeout: 10000 });

    // Unsupported video format is rejected with a Kazakh message, image stays intact (both can coexist per item 11).
    await newCard.getByText("Видео жүктеу").locator("..").locator('input[type="file"]').setInputFiles({
      name: "clip.avi",
      mimeType: "video/x-msvideo",
      buffer: FAKE_VIDEO,
    });
    await expect(page.getByText(/Қолдау көрсетілмейтін бейне форматы/)).toBeVisible({ timeout: 10000 });
    await expect(newCard.locator("img").first()).toBeVisible();
    await expect(newCard.locator("video")).toHaveCount(0);

    // Clean up (never saved, but the card exists in the editor's local list — remove it via delete).
    await newCard.locator('input[id^="slug-"]').fill(`cleanup-${Date.now()}`);
    await newCard.getByRole("button", { name: "Жоба нұсқасын сақтау" }).click();
    await expect(page.getByText("Жоба нұсқасы сақталды")).toBeVisible({ timeout: 10000 });
    page.once("dialog", (d) => d.accept());
    await newCard.getByRole("button", { name: "Жою" }).click();
    await expect(page.getByText("Жаңалық жойылды")).toBeVisible({ timeout: 10000 });
  });
});
