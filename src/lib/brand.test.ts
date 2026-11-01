import { describe, expect, it } from "vitest";
import { BRAND_NAME, rebrandDeep, rebrandText } from "@/lib/brand";

describe("rebrandText", () => {
  it.each([
    ["Eco Start", BRAND_NAME],
    ["Eco Start AI", BRAND_NAME],
    ["Эко Start", BRAND_NAME],
    ["Эко Старт", BRAND_NAME],
    ["ECO START", BRAND_NAME],
    ["«Эко Start» цифрлық орталығы", `«${BRAND_NAME}» цифрлық орталығы`],
    ["Eco Start AI — платформа", `${BRAND_NAME} — платформа`],
    ["Eco-Start", BRAND_NAME],
    // Kazakh case endings re-agree with the new final sound
    ["Бөбекжайыңызды «Эко Start»-қа қосыңыз", `Бөбекжайыңызды «${BRAND_NAME}»-ға қосыңыз`],
    ["Эко Start-тың модульдері", `${BRAND_NAME}-ның модульдері`],
    ["«Эко Старт»-та", `«${BRAND_NAME}»-да`],
  ])("%s → rebranded", (input, expected) => {
    expect(rebrandText(input)).toBe(expected);
  });

  it("leaves identifiers, e-mails and other words alone", () => {
    for (const s of [
      "teacher@ecostart.local",
      "EcoStart2026!",
      "eco_start_session",
      "Эко Зертхана",
      "Эко Көмекші",
      "Eco AI помощник",
      "Startup",
      "https://ecostart.alemprofi.com/kk",
    ]) {
      expect(rebrandText(s)).toBe(s);
    }
  });
});

describe("rebrandDeep", () => {
  it("rewrites strings inside nested CMS content, keeps other values", () => {
    const row = {
      id: "x",
      version: 3,
      published_at: null,
      content: { kk: { title: "«Эко Start» модульдері" }, en: { title: "Eco Start AI" } },
      tags: ["Eco Start", 1],
    };
    expect(rebrandDeep(row)).toEqual({
      id: "x",
      version: 3,
      published_at: null,
      content: { kk: { title: `«${BRAND_NAME}» модульдері` }, en: { title: BRAND_NAME } },
      tags: [BRAND_NAME, 1],
    });
  });
});
