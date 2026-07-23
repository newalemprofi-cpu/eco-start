import { describe, expect, it } from "vitest";
import {
  GROUP_DEFINITIONS,
  buildChildImportKey,
  buildPersonImportKey,
  generateChildLoginCode,
  generateImportEmail,
  generateReviewLoginCode,
  generateStrongPin,
  isWeakPin,
  mapGroupNameToDefinition,
  normalizeName,
  parseChildrenRows,
  splitPedagogCell,
  transliterate,
  validateExpectedGroups,
  type RawChildRow,
} from "./parse-excel";

describe("mapGroupNameToDefinition", () => {
  it("maps all 11 real group names to their definition", () => {
    expect(GROUP_DEFINITIONS).toHaveLength(11);
    for (const def of GROUP_DEFINITIONS) {
      expect(mapGroupNameToDefinition(def.excelName)).toEqual(def);
    }
  });

  it("tolerates surrounding/collapsed whitespace", () => {
    expect(mapGroupNameToDefinition('  "Шұғыла" мектепалды тобы  ')).toEqual(
      mapGroupNameToDefinition('"Шұғыла" мектепалды тобы')
    );
  });

  it("throws on an unrecognized group name", () => {
    expect(() => mapGroupNameToDefinition('"Белгісіз" тобы')).toThrow(/Танылмаған топ атауы/);
  });

  it("maps ортаңғы/ересек/мектепалды to the correct age category", () => {
    expect(mapGroupNameToDefinition('"Айгөлек" ортаңғы тобы').ageCategory).toBe("MIDDLE_3");
    expect(mapGroupNameToDefinition('"Балапан" ересек тобы').ageCategory).toBe("SENIOR_4");
    expect(mapGroupNameToDefinition('"Шұғыла" мектепалды тобы').ageCategory).toBe("PRESCHOOL_5");
  });
});

describe("splitPedagogCell", () => {
  it("splits a comma-separated two-person cell", () => {
    expect(splitPedagogCell("Жанаисова Тойганым Ескабыловна, Адиетова Айгерим Ашыккызы")).toEqual([
      "Жанаисова Тойганым Ескабыловна",
      "Адиетова Айгерим Ашыккызы",
    ]);
  });

  it("splits a comma-separated cell with irregular spacing around the comma", () => {
    expect(splitPedagogCell("Хабадашева Гулжазира Куанышевна ,  Исмагамбетова Куляш Дюсеновна")).toEqual([
      "Хабадашева Гулжазира Куанышевна",
      "Исмагамбетова Куляш Дюсеновна",
    ]);
  });

  it("splits a space-only 6-word cell into two 3-word names", () => {
    expect(splitPedagogCell("Ерсаин Гүлмайра Ергенқызы           Кенжебаева Айымгүл Рыскалиевна")).toEqual([
      "Ерсаин Гүлмайра Ергенқызы",
      "Кенжебаева Айымгүл Рыскалиевна",
    ]);
  });

  it("returns a single name for a 3-word cell (no assistant)", () => {
    expect(splitPedagogCell("Жапақова Әсел Мұрадымқызы")).toEqual(["Жапақова Әсел Мұрадымқызы"]);
  });

  it("throws on an empty cell", () => {
    expect(() => splitPedagogCell("")).toThrow(/бос/);
  });

  it("throws on an unparseable word count", () => {
    expect(() => splitPedagogCell("Бір Екі")).toThrow(/бөлу мүмкін болмады/);
    expect(() => splitPedagogCell("Бір Екі Үш Төрт")).toThrow(/бөлу мүмкін болмады/);
  });

  it("throws if a comma-separated part isn't a clean 3-word name", () => {
    expect(() => splitPedagogCell("Аты Жөні, Тек Екі")).toThrow(/3 сөзден тұруы керек/);
  });
});

describe("normalizeName / import keys", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeName("  Айым   Демо  ")).toBe("айым демо");
  });

  it("builds stable, role-namespaced person keys", () => {
    expect(buildPersonImportKey("TEACHER", "Шамуратова Айнұр Абаевна")).toBe(
      "teacher:шамуратова айнұр абаевна"
    );
    expect(buildPersonImportKey("PARENT", "Рысмаганбетова Гулзада Ишановна")).toBe(
      "parent:рысмаганбетова гулзада ишановна"
    );
  });

  it("builds a child key from (child, parent) that's stable regardless of casing/whitespace", () => {
    const a = buildChildImportKey("Мұнайдар Рухия", "Рысмаганбетова Гулзада");
    const b = buildChildImportKey("  мұнайдар   рухия ", " РЫСМАГАНБЕТОВА  ГУЛЗАДА ");
    expect(a).toBe(b);
  });
});

describe("transliterate / generateImportEmail", () => {
  it("produces an ascii, hyphenated slug from Kazakh Cyrillic", () => {
    expect(transliterate("Шамуратова Айнұр")).toMatch(/^[a-z0-9-]+$/);
  });

  it("always includes the sequence number, guaranteeing uniqueness even for identical names", () => {
    const a = generateImportEmail("Айгерим Ашыккызы", 1);
    const b = generateImportEmail("Айгерим Ашыккызы", 2);
    expect(a).not.toBe(b);
    expect(a).toMatch(/@import\.local$/);
  });
});

describe("login code generators", () => {
  it("formats a child login code as <GROUP-CODE>-<SEQUENCE>", () => {
    expect(generateChildLoginCode("SHUGYLA-01", 1)).toBe("SHUGYLA-01-01");
    expect(generateChildLoginCode("SHUGYLA-01", 23)).toBe("SHUGYLA-01-23");
  });

  it("formats needs-review codes as REVIEW-NNN", () => {
    expect(generateReviewLoginCode(1)).toBe("REVIEW-001");
    expect(generateReviewLoginCode(2)).toBe("REVIEW-002");
  });
});

describe("PIN strength", () => {
  it("flags all 4 explicitly forbidden weak patterns plus repeated-digit PINs", () => {
    expect(isWeakPin("0000")).toBe(true);
    expect(isWeakPin("1111")).toBe(true);
    expect(isWeakPin("1234")).toBe(true);
    expect(isWeakPin("4321")).toBe(true);
    expect(isWeakPin("7777")).toBe(true);
  });

  it("does not flag an ordinary PIN", () => {
    expect(isWeakPin("5273")).toBe(false);
  });

  it("retries until a non-weak PIN is produced", () => {
    const scripted = [0, 1111, 5273]; // 0000 (weak), 1111 (weak), 5273 (ok)
    let i = 0;
    const pin = generateStrongPin(() => scripted[i++]);
    expect(pin).toBe("5273");
    expect(i).toBe(3);
  });

  it("real (crypto-backed) generation never returns a weak PIN across many samples", () => {
    for (let i = 0; i < 200; i++) {
      expect(isWeakPin(generateStrongPin())).toBe(false);
    }
  });
});

function row(child: string, parent: string, groupText: string, pedagogText: string, n: number): RawChildRow {
  return { child, parent, groupText, pedagogText, excelRowNumber: n };
}

const SHUGYLA = '"Шұғыла" мектепалды тобы';
const BALAPAN = '"Балапан" ересек тобы';
const ERKETAI = '"Еркетай" ортаңғы тобы';
const SHUGYLA_PED = "Шамуратова Айнұр Абаевна Махсот Альмира Жүсіпқызы";
const BALAPAN_PED = "Қабесова Қалес Жауынбайқызы, Шайхина Альбина Алибаевна";
const ERKETAI_PED = "Жапақова Әсел Мұрадымқызы"; // no assistant, matches the real Еркетай row shape

describe("parseChildrenRows", () => {
  it("parses a clean sheet into groups/teachers/assistants/parents/children with matching counts", () => {
    const rows: RawChildRow[] = [
      row("Бала Біреу", "Ата-ана Біреу", SHUGYLA, SHUGYLA_PED, 2),
      row("Бала Екі", "Ата-ана Екі", SHUGYLA, SHUGYLA_PED, 3),
      row("Бала Үш", "Ата-ана Үш", ERKETAI, ERKETAI_PED, 4),
    ];
    const parsed = parseChildrenRows(rows);
    expect(parsed.stats.totalRows).toBe(3);
    expect(parsed.stats.uniqueChildren).toBe(3);
    expect(parsed.stats.needsReviewCount).toBe(0);
    expect(parsed.stats.assignedChildCount).toBe(3);
    // Еркетай has no assistant — assistantKey stays null, matching the real sheet.
    const erketai = parsed.groups.find((g) => g.code === "ERKETAI-01")!;
    expect(erketai.assistantKey).toBeNull();
    const shugyla = parsed.groups.find((g) => g.code === "SHUGYLA-01")!;
    expect(shugyla.assistantKey).not.toBeNull();
  });

  it("collapses a child+parent pair listed under two different groups into ONE needs-review child, not two", () => {
    const rows: RawChildRow[] = [
      row("Мусағали Фатима", "Бекмурзиева Лаззат", BALAPAN, BALAPAN_PED, 197),
      row("Акбулатов Бексултан", "Акбулатова Араилым", BALAPAN, BALAPAN_PED, 198),
      row("Мусағали Фатима", "Бекмурзиева Лаззат", ERKETAI, ERKETAI_PED, 216),
      row("Акбулатов Бексултан", "Акбулатова Араилым", ERKETAI, ERKETAI_PED, 217),
    ];
    const parsed = parseChildrenRows(rows);
    expect(parsed.stats.totalRows).toBe(4);
    expect(parsed.stats.uniqueChildren).toBe(2); // collapsed, not 4 and not 2 duplicated users
    expect(parsed.stats.needsReviewCount).toBe(2);
    expect(parsed.stats.assignedChildCount).toBe(0);

    const fatima = parsed.children.find((c) => c.name === "Мусағали Фатима")!;
    expect(fatima.needsReview).toBe(true);
    expect(fatima.groupCode).toBeNull();
    expect(fatima.candidateGroupCodes.sort()).toEqual(["BALAPAN-01", "ERKETAI-01"]);
  });

  it("does NOT flag ordinary siblings (different children, same parent) as needing review", () => {
    const rows: RawChildRow[] = [
      row("Бала Ағасы", "Ортақ Ата-ана", SHUGYLA, SHUGYLA_PED, 10),
      row("Бала Қарындасы", "Ортақ Ата-ана", ERKETAI, ERKETAI_PED, 11),
    ];
    const parsed = parseChildrenRows(rows);
    expect(parsed.stats.uniqueChildren).toBe(2);
    expect(parsed.stats.needsReviewCount).toBe(0);
    expect(parsed.stats.uniqueParents).toBe(1);
  });

  it("throws if the same group cites a different teacher/assistant on different rows", () => {
    const rows: RawChildRow[] = [
      row("Бала А", "Ата-ана А", SHUGYLA, SHUGYLA_PED, 2),
      row("Бала Б", "Ата-ана Б", SHUGYLA, "Басқа Тәрбиеші Аты", 3),
    ];
    expect(() => parseChildrenRows(rows)).toThrow(/тұрақты емес/);
  });

  it("throws on an empty required field", () => {
    const rows: RawChildRow[] = [row("", "Ата-ана А", SHUGYLA, SHUGYLA_PED, 2)];
    expect(() => parseChildrenRows(rows)).toThrow(/Бала өрісі бос/);
  });
});

describe("validateExpectedGroups", () => {
  it("passes silently when all 11 real groups are present", () => {
    const rows: RawChildRow[] = GROUP_DEFINITIONS.map((def, i) =>
      row(`Бала ${i}`, `Ата-ана ${i}`, def.excelName, SHUGYLA_PED, i + 2)
    );
    const parsed = parseChildrenRows(rows);
    expect(() => validateExpectedGroups(parsed)).not.toThrow();
  });

  it("throws naming exactly which group codes are missing from a partial sheet", () => {
    const rows: RawChildRow[] = [row("Бала А", "Ата-ана А", SHUGYLA, SHUGYLA_PED, 2)];
    const parsed = parseChildrenRows(rows);
    expect(() => validateExpectedGroups(parsed)).toThrow(/BOTAKAN-01/);
  });
});
