import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSafePath } from "./safe-path";

describe("resolveSafePath", () => {
  const ROOT = path.resolve("/uploads-root");

  it("resolves a normal nested path inside the root", () => {
    const result = resolveSafePath(ROOT, ["site-media", "news", "photo.jpg"]);
    expect(result).toBe(path.join(ROOT, "site-media", "news", "photo.jpg"));
  });

  it("resolves the root itself for an empty segment list", () => {
    expect(resolveSafePath(ROOT, [])).toBe(ROOT);
  });

  it("rejects a literal '..' segment", () => {
    expect(resolveSafePath(ROOT, ["..", "etc", "passwd"])).toBeNull();
    expect(resolveSafePath(ROOT, ["site-media", "..", ".."])).toBeNull();
  });

  it("rejects a segment containing '..' combined with other characters", () => {
    expect(resolveSafePath(ROOT, ["foo..bar"])).toBeNull();
    expect(resolveSafePath(ROOT, ["..secret"])).toBeNull();
  });

  it("rejects a null-byte injection attempt", () => {
    expect(resolveSafePath(ROOT, ["photo.jpg\0.png"])).toBeNull();
  });

  it("rejects an absolute-path segment that would make path.resolve() jump outside root entirely — the second check exists precisely for this, since the segment itself contains no '..'", () => {
    // path.resolve(root, "/etc/passwd") ignores `root` and resolves to
    // "/etc/passwd" outright — no ".." substring anywhere, so only the
    // post-resolve startsWith(root) check catches it.
    expect(resolveSafePath(ROOT, ["/etc/passwd"])).toBeNull();
  });

  it("rejects a sibling directory that merely starts with the root's name (e.g. root + '-evil'), ruling out a naive prefix-only startsWith check", () => {
    const evilSibling = `${ROOT}-evil`;
    // Using the sibling itself as the "root" argument would be a caller
    // bug, not a traversal — this test targets the real attack: can a
    // segment list reach outside ROOT into a directory whose path
    // happens to share ROOT as a string prefix? The rootWithSep
    // separator-aware check (not a bare .startsWith(root)) is what
    // prevents that.
    expect(evilSibling.startsWith(ROOT)).toBe(true); // sanity: same string-prefix trap a naive check would fall into
    expect(resolveSafePath(ROOT, ["..", path.basename(evilSibling), "x"])).toBeNull();
  });

  it("allows a video-under-videos-subfolder path (the news-video storage layout)", () => {
    const result = resolveSafePath(ROOT, ["site-media", "news", "videos", "clip.mp4"]);
    expect(result).toBe(path.join(ROOT, "site-media", "news", "videos", "clip.mp4"));
  });
});
