import { afterEach, describe, expect, it } from "vitest";
import { StorageValidationError, validateVideoUpload } from "./types";

describe("validateVideoUpload", () => {
  const originalEnv = process.env.MAX_VIDEO_UPLOAD_MB;

  afterEach(() => {
    process.env.MAX_VIDEO_UPLOAD_MB = originalEnv;
  });

  it("accepts a valid MP4 upload", () => {
    expect(() =>
      validateVideoUpload({ type: "video/mp4", size: 1024, name: "clip.mp4" })
    ).not.toThrow();
  });

  it("accepts a valid WebM upload", () => {
    expect(() =>
      validateVideoUpload({ type: "video/webm", size: 1024, name: "clip.webm" })
    ).not.toThrow();
  });

  it("accepts a valid MOV upload (video/quicktime)", () => {
    expect(() =>
      validateVideoUpload({ type: "video/quicktime", size: 1024, name: "clip.mov" })
    ).not.toThrow();
  });

  it("rejects an unsupported MIME type with a Kazakh error message", () => {
    expect(() => validateVideoUpload({ type: "video/x-flv", size: 1024, name: "clip.flv" })).toThrowError(
      StorageValidationError
    );
    try {
      validateVideoUpload({ type: "video/x-flv", size: 1024, name: "clip.flv" });
    } catch (err) {
      expect((err as Error).message).toContain("Қолдау көрсетілмейтін бейне форматы");
    }
  });

  it("rejects when the MIME type is allowed but the file extension doesn't match (spoofed extension)", () => {
    expect(() => validateVideoUpload({ type: "video/mp4", size: 1024, name: "clip.exe" })).toThrowError(
      StorageValidationError
    );
  });

  it("rejects an image MIME type outright", () => {
    expect(() => validateVideoUpload({ type: "image/jpeg", size: 1024, name: "photo.jpg" })).toThrowError(
      StorageValidationError
    );
  });

  it("rejects a file over the default 100MB limit with a Kazakh error message", () => {
    delete process.env.MAX_VIDEO_UPLOAD_MB;
    const tooLarge = 101 * 1024 * 1024;
    expect(() => validateVideoUpload({ type: "video/mp4", size: tooLarge, name: "big.mp4" })).toThrowError(
      StorageValidationError
    );
    try {
      validateVideoUpload({ type: "video/mp4", size: tooLarge, name: "big.mp4" });
    } catch (err) {
      expect((err as Error).message).toContain("тым үлкен");
    }
  });

  it("accepts a file right at the default limit", () => {
    delete process.env.MAX_VIDEO_UPLOAD_MB;
    const atLimit = 100 * 1024 * 1024;
    expect(() => validateVideoUpload({ type: "video/mp4", size: atLimit, name: "ok.mp4" })).not.toThrow();
  });

  it("honors MAX_VIDEO_UPLOAD_MB when set (item 16 of the spec)", () => {
    process.env.MAX_VIDEO_UPLOAD_MB = "5";
    const overFiveMb = 6 * 1024 * 1024;
    expect(() => validateVideoUpload({ type: "video/mp4", size: overFiveMb, name: "clip.mp4" })).toThrowError(
      StorageValidationError
    );
    expect(() =>
      validateVideoUpload({ type: "video/mp4", size: 4 * 1024 * 1024, name: "clip.mp4" })
    ).not.toThrow();
  });

  it("falls back to the 100MB default when MAX_VIDEO_UPLOAD_MB is not a valid number", () => {
    process.env.MAX_VIDEO_UPLOAD_MB = "not-a-number";
    expect(() =>
      validateVideoUpload({ type: "video/mp4", size: 50 * 1024 * 1024, name: "clip.mp4" })
    ).not.toThrow();
  });
});
