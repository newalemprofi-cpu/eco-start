import { describe, expect, it } from "vitest";
import { parseRange } from "./byte-range";

describe("parseRange", () => {
  const SIZE = 1000;

  it("returns null when there is no Range header — serve the full file", () => {
    expect(parseRange(null, SIZE)).toBeNull();
  });

  it("returns null for a header it doesn't recognize as a bytes range", () => {
    expect(parseRange("items=0-1", SIZE)).toBeNull();
    expect(parseRange("not a range", SIZE)).toBeNull();
  });

  it("parses a normal start-end range", () => {
    expect(parseRange("bytes=0-499", SIZE)).toEqual({ start: 0, end: 499 });
    expect(parseRange("bytes=500-999", SIZE)).toEqual({ start: 500, end: 999 });
  });

  it("parses an open-ended range (from start to EOF)", () => {
    expect(parseRange("bytes=500-", SIZE)).toEqual({ start: 500, end: 999 });
  });

  it("parses a suffix range (last N bytes)", () => {
    expect(parseRange("bytes=-500", SIZE)).toEqual({ start: 500, end: 999 });
    // Suffix longer than the file just clamps to the whole file, not an error.
    expect(parseRange("bytes=-5000", SIZE)).toEqual({ start: 0, end: 999 });
  });

  it("clamps an end past the file size down to the last byte, rather than rejecting", () => {
    expect(parseRange("bytes=900-99999", SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("is unsatisfiable when both start and end are empty", () => {
    expect(parseRange("bytes=-", SIZE)).toBe("unsatisfiable");
  });

  it("is unsatisfiable when start is beyond the file size", () => {
    expect(parseRange("bytes=1000-1500", SIZE)).toBe("unsatisfiable");
    expect(parseRange("bytes=2000-", SIZE)).toBe("unsatisfiable");
  });

  it("is unsatisfiable when end is before start", () => {
    expect(parseRange("bytes=500-100", SIZE)).toBe("unsatisfiable");
  });

  it("is unsatisfiable for a zero-length suffix", () => {
    expect(parseRange("bytes=-0", SIZE)).toBe("unsatisfiable");
  });

  it("handles a zero-sized file as always unsatisfiable for any concrete range", () => {
    expect(parseRange("bytes=0-0", 0)).toBe("unsatisfiable");
  });
});
