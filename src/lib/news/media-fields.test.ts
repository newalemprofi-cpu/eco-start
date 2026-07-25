import { describe, expect, it } from "vitest";
import { normalizeNewsMediaFields } from "./media-fields";

// Regression test for the production crash: "TypeError: Cannot read
// properties of undefined (reading 'map')" in news-editor.tsx, caused
// by video_urls being absent/null on a news row read from a database
// where migration 0013_news_video.sql hadn't run yet (or any other
// path that leaves these jsonb fields malformed).

describe("normalizeNewsMediaFields", () => {
  it("leaves already-well-formed fields untouched — an existing item with main_video_url=null, video_urls=[]", () => {
    const existingItem = {
      id: "abc",
      title: "Жаңалық",
      main_image_url: "/uploads/site-media/news/photo.jpg",
      gallery_urls: ["/uploads/a.jpg", "/uploads/b.jpg"],
      main_video_url: null,
      video_urls: [],
    };
    const result = normalizeNewsMediaFields(existingItem);
    expect(result.main_video_url).toBeNull();
    expect(result.video_urls).toEqual([]);
    expect(result.gallery_urls).toEqual(["/uploads/a.jpg", "/uploads/b.jpg"]);
    expect(Array.isArray(result.video_urls)).toBe(true);
    expect(Array.isArray(result.gallery_urls)).toBe(true);
  });

  it("normalizes a missing video_urls property (the exact production crash case) to an empty array", () => {
    const rowMissingVideoUrls = {
      id: "abc",
      title: "Жаңалық",
      gallery_urls: ["/uploads/a.jpg"],
      // video_urls intentionally absent — simulates a jsonb column read
      // from a database where the migration adding it hasn't run yet.
    };
    const result = normalizeNewsMediaFields(rowMissingVideoUrls);
    expect(result.video_urls).toEqual([]);
    expect(() => result.video_urls.map((u) => u)).not.toThrow();
  });

  it("normalizes a missing gallery_urls property to an empty array", () => {
    const rowMissingGalleryUrls = { id: "abc", video_urls: [] };
    const result = normalizeNewsMediaFields(rowMissingGalleryUrls);
    expect(result.gallery_urls).toEqual([]);
    expect(() => result.gallery_urls.map((u) => u)).not.toThrow();
  });

  it("normalizes an explicit null video_urls (jsonb null instead of jsonb '[]') to an empty array", () => {
    const result = normalizeNewsMediaFields({ video_urls: null, gallery_urls: null });
    expect(result.video_urls).toEqual([]);
    expect(result.gallery_urls).toEqual([]);
  });

  it("normalizes undefined main_video_url to null", () => {
    const result = normalizeNewsMediaFields({ main_video_url: undefined });
    expect(result.main_video_url).toBeNull();
  });

  it("normalizes a missing main_video_url property to null", () => {
    const result = normalizeNewsMediaFields({});
    expect(result.main_video_url).toBeNull();
  });

  it("normalizes malformed (non-array, non-null) jsonb values instead of trusting them", () => {
    // A jsonb column can in principle hold any JSON value, not just an
    // array — a string, a number, or an object are all "malformed" for
    // a field this code always treats as string[].
    expect(normalizeNewsMediaFields({ video_urls: "not-an-array" }).video_urls).toEqual([]);
    expect(normalizeNewsMediaFields({ video_urls: { url: "x" } }).video_urls).toEqual([]);
    expect(normalizeNewsMediaFields({ video_urls: 42 }).video_urls).toEqual([]);
  });

  it("does not mutate the input object", () => {
    const input: { video_urls?: unknown } = {};
    normalizeNewsMediaFields(input);
    expect(input.video_urls).toBeUndefined();
  });

  it("preserves every other field on the row untouched", () => {
    const row = { id: "abc", title: "Жаңалық", enabled: true, display_order: 3, video_urls: undefined };
    const result = normalizeNewsMediaFields(row);
    expect(result.id).toBe("abc");
    expect(result.title).toBe("Жаңалық");
    expect(result.enabled).toBe(true);
    expect(result.display_order).toBe(3);
  });
});
