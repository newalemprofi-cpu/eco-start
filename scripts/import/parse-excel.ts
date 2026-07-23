/**
 * Pure, dependency-free parsing/mapping/key-generation logic for the
 * private-data/1.xlsx production import (scripts/import-private-data.ts).
 * No filesystem/DB access here on purpose — everything in this file is
 * unit-testable without a real Excel file or database connection (see
 * scripts/import/parse-excel.test.ts). Reading the actual .xlsx lives in
 * scripts/import/read-workbook.ts, which calls into this module.
 */
import { randomInt, randomBytes } from "node:crypto";

export type GroupAgeCategory = "MIDDLE_3" | "SENIOR_4" | "PRESCHOOL_5";

export type GroupDefinition = {
  /** Exact text as it appears (trimmed, whitespace-collapsed) in the "тобы " column. */
  excelName: string;
  code: string;
  ageCategory: GroupAgeCategory;
};

// The 11 real groups, verbatim from the approved import spec — matching
// against a fixed dictionary (rather than parsing "ортаңғы/ересек/
// мектепалды" out of free text) means any unrecognized group name in a
// future re-run of the Excel aborts loudly instead of silently guessing.
export const GROUP_DEFINITIONS: GroupDefinition[] = [
  { excelName: '"Шұғыла" мектепалды тобы', code: "SHUGYLA-01", ageCategory: "PRESCHOOL_5" },
  { excelName: '"Ботақан" ересек тобы', code: "BOTAKAN-01", ageCategory: "SENIOR_4" },
  { excelName: '"Алтын сақа" ересек тобы', code: "ALTYN-SAKA-01", ageCategory: "SENIOR_4" },
  { excelName: '"Ертөстік" мектепалды тобы', code: "ERTOSTIK-01", ageCategory: "PRESCHOOL_5" },
  { excelName: '"Жұлдыз" мектепалды тобы', code: "ZHULDYZ-01", ageCategory: "PRESCHOOL_5" },
  { excelName: '"Гүлдер" мектепалды тобы', code: "GULDER-01", ageCategory: "PRESCHOOL_5" },
  { excelName: '"Айналайын" ересек тобы', code: "AINALAYIN-01", ageCategory: "SENIOR_4" },
  { excelName: '"Айгөлек" ортаңғы тобы', code: "AIGOLEK-01", ageCategory: "MIDDLE_3" },
  { excelName: '"Құлыншақ" ортаңғы тобы', code: "KULYNSHAK-01", ageCategory: "MIDDLE_3" },
  { excelName: '"Балапан" ересек тобы', code: "BALAPAN-01", ageCategory: "SENIOR_4" },
  { excelName: '"Еркетай" ортаңғы тобы', code: "ERKETAI-01", ageCategory: "MIDDLE_3" },
];

export function mapGroupNameToDefinition(excelGroupText: string): GroupDefinition {
  const normalized = excelGroupText.trim().replace(/\s+/g, " ");
  const found = GROUP_DEFINITIONS.find((g) => g.excelName === normalized);
  if (!found) {
    throw new Error(
      `Танылмаған топ атауы: "${excelGroupText}" — GROUP_DEFINITIONS тізіміндегі 11 топтың ешқайсысына сәйкес келмейді.`
    );
  }
  return found;
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function assertThreeWordName(name: string, originalCell: string) {
  const wc = wordCount(name);
  if (wc !== 3) {
    throw new Error(
      `Тәрбиеші/ассистент аты-жөні 3 сөзден тұруы керек, алынғаны ${wc}: "${name}" (ұяшық: "${originalCell}")`
    );
  }
}

/**
 * The "Педагог" cell packs the main teacher and (usually) the assistant
 * into one free-text cell with an unstable separator: sometimes a comma,
 * sometimes just extra whitespace, sometimes none at all when there's no
 * assistant. Returns [mainTeacher] or [mainTeacher, assistant].
 */
export function splitPedagogCell(raw: string): string[] {
  const s = (raw ?? "").trim();
  if (!s) throw new Error("Педагог ұяшығы бос");

  if (s.includes(",")) {
    const parts = s
      .split(",")
      .map((p) => p.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    parts.forEach((p) => assertThreeWordName(p, raw));
    if (parts.length > 2) {
      throw new Error(`Педагог ұяшығында 2-ден артық адам табылды: "${raw}"`);
    }
    return parts;
  }

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 3) return [words.join(" ")];
  if (words.length === 6) return [words.slice(0, 3).join(" "), words.slice(3, 6).join(" ")];
  throw new Error(`Педагог ұяшығын бөлу мүмкін болмады (сөз саны=${words.length}): "${raw}"`);
}

export function normalizeName(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildPersonImportKey(role: "TEACHER" | "PARENT", name: string): string {
  return `${role.toLowerCase()}:${normalizeName(name)}`;
}

export function buildChildImportKey(childName: string, parentName: string): string {
  return `child:${normalizeName(childName)}::${normalizeName(parentName)}`;
}

// Cyrillic (incl. Kazakh-specific letters) -> Latin, for synthetic
// @import.local email local-parts. Same transliteration convention
// already used for Kazakh news slugs earlier this session.
const TRANSLIT_MAP: Record<string, string> = {
  а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "e",
  ж: "zh", з: "z", и: "i", й: "i", і: "i", к: "k", қ: "q", л: "l", м: "m",
  н: "n", ң: "ng", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ұ: "u", ү: "u", ф: "f", х: "h", һ: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterate(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT_MAP ? TRANSLIT_MAP[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function generateImportEmail(fullName: string, sequence: number): string {
  const slug = transliterate(fullName) || "user";
  return `${slug}-${String(sequence).padStart(3, "0")}@import.local`;
}

export function generateChildLoginCode(groupCode: string, sequence: number): string {
  return `${groupCode}-${String(sequence).padStart(2, "0")}`;
}

export function generateReviewLoginCode(n: number): string {
  return `REVIEW-${String(n).padStart(3, "0")}`;
}

const WEAK_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321",
]);

export function isWeakPin(pin: string): boolean {
  return WEAK_PINS.has(pin);
}

/** Defaults to crypto.randomInt (secure) for real use; tests inject a
 * deterministic generator to exercise the weak-PIN retry loop without
 * needing to fight actual randomness. */
export function generateStrongPin(randomFourDigit: () => number = () => randomInt(0, 10000)): string {
  let pin: string;
  do {
    pin = String(randomFourDigit()).padStart(4, "0");
  } while (isWeakPin(pin));
  return pin;
}

export function generateTempPassword(): string {
  return randomBytes(12).toString("base64url");
}

export type RawChildRow = {
  child: string;
  parent: string;
  groupText: string;
  pedagogText: string;
  excelRowNumber: number;
};

export type ParsedGroup = {
  importKey: string;
  code: string;
  excelName: string;
  ageCategory: GroupAgeCategory;
  mainTeacherKey: string;
  assistantKey: string | null;
};

export type ParsedChild = {
  importKey: string;
  name: string;
  parentKey: string;
  parentName: string;
  groupCode: string | null;
  needsReview: boolean;
  candidateGroupCodes: string[];
};

export type ParsedWorkbook = {
  groups: ParsedGroup[];
  teachers: Map<string, string>;
  assistants: Map<string, string>;
  parents: Map<string, string>;
  children: ParsedChild[];
  stats: {
    totalRows: number;
    uniqueChildren: number;
    uniqueParents: number;
    groupCount: number;
    teacherCount: number;
    assistantCount: number;
    needsReviewCount: number;
    assignedChildCount: number;
  };
};

/**
 * Turns the 232 raw "Бала" sheet rows into the fully deduped/validated
 * shape the import script writes to the database. Two responsibilities
 * that only make sense looking at the WHOLE sheet at once (not row by
 * row): (a) verifying each group's teacher/assistant is consistent
 * across every row that cites it, (b) detecting the "same child+parent
 * listed under two different groups" needs-review case by grouping rows
 * on (normalized child name, normalized parent name).
 */
export function parseChildrenRows(rows: RawChildRow[]): ParsedWorkbook {
  const teachers = new Map<string, string>();
  const assistants = new Map<string, string>();
  const parents = new Map<string, string>();
  const groupAssignment = new Map<string, { mainKey: string; assistantKey: string | null }>();

  for (const row of rows) {
    const def = mapGroupNameToDefinition(row.groupText);
    const people = splitPedagogCell(row.pedagogText);
    const mainName = people[0];
    const assistantName = people[1] ?? null;
    const mainKey = buildPersonImportKey("TEACHER", mainName);
    teachers.set(mainKey, mainName);
    let assistantKey: string | null = null;
    if (assistantName) {
      assistantKey = buildPersonImportKey("TEACHER", assistantName);
      assistants.set(assistantKey, assistantName);
    }

    const existing = groupAssignment.get(def.code);
    if (existing) {
      if (existing.mainKey !== mainKey || existing.assistantKey !== assistantKey) {
        throw new Error(
          `"${def.code}" тобында тәрбиеші/ассистент жол бойынша тұрақты емес (excel row ${row.excelRowNumber})`
        );
      }
    } else {
      groupAssignment.set(def.code, { mainKey, assistantKey });
    }

    if (!row.parent || !row.parent.trim()) {
      throw new Error(`Ата-ана өрісі бос: excel row ${row.excelRowNumber}`);
    }
    parents.set(buildPersonImportKey("PARENT", row.parent), row.parent.trim());
  }

  // Only builds groups actually encountered in the given rows — whether
  // that matches the full expected 11-group roster is a separate concern
  // (see validateExpectedGroups below), so this function stays testable
  // against small row subsets, not just the real 232-row sheet.
  const groups: ParsedGroup[] = [...groupAssignment.entries()].map(([code, assign]) => {
    const def = GROUP_DEFINITIONS.find((g) => g.code === code)!;
    return {
      importKey: `group:${code}`,
      code,
      excelName: def.excelName,
      ageCategory: def.ageCategory,
      mainTeacherKey: assign.mainKey,
      assistantKey: assign.assistantKey,
    };
  });

  const rowsByChildKey = new Map<string, { groupCode: string }[]>();
  const infoByChildKey = new Map<string, { childName: string; parentName: string; parentKey: string }>();
  for (const row of rows) {
    if (!row.child || !row.child.trim()) {
      throw new Error(`Бала өрісі бос: excel row ${row.excelRowNumber}`);
    }
    const def = mapGroupNameToDefinition(row.groupText);
    const key = buildChildImportKey(row.child, row.parent);
    if (!rowsByChildKey.has(key)) rowsByChildKey.set(key, []);
    rowsByChildKey.get(key)!.push({ groupCode: def.code });
    infoByChildKey.set(key, {
      childName: row.child.trim(),
      parentName: row.parent.trim(),
      parentKey: buildPersonImportKey("PARENT", row.parent),
    });
  }

  const children: ParsedChild[] = [];
  for (const [key, occurrences] of rowsByChildKey) {
    const distinctGroupCodes = [...new Set(occurrences.map((o) => o.groupCode))];
    const info = infoByChildKey.get(key)!;
    const needsReview = distinctGroupCodes.length > 1;
    children.push({
      importKey: key,
      name: info.childName,
      parentKey: info.parentKey,
      parentName: info.parentName,
      groupCode: needsReview ? null : distinctGroupCodes[0],
      needsReview,
      candidateGroupCodes: needsReview ? distinctGroupCodes : [],
    });
  }

  return {
    groups,
    teachers,
    assistants,
    parents,
    children,
    stats: {
      totalRows: rows.length,
      uniqueChildren: children.length,
      uniqueParents: parents.size,
      groupCount: groups.length,
      teacherCount: teachers.size,
      assistantCount: assistants.size,
      needsReviewCount: children.filter((c) => c.needsReview).length,
      assignedChildCount: children.filter((c) => !c.needsReview).length,
    },
  };
}

/** Asserts every one of the 11 real groups was actually present in the
 * parsed sheet — a completeness check against the fixed roster, kept
 * separate from parseChildrenRows so that function stays testable
 * against small row subsets. Used by the import script against the real
 * 232-row file, never by unit tests using partial fixtures. */
export function validateExpectedGroups(parsed: ParsedWorkbook): void {
  const foundCodes = new Set(parsed.groups.map((g) => g.code));
  const missing = GROUP_DEFINITIONS.filter((def) => !foundCodes.has(def.code));
  if (missing.length > 0) {
    throw new Error(`Excel-де мына топ(тар) табылмады: ${missing.map((m) => m.code).join(", ")}`);
  }
}
