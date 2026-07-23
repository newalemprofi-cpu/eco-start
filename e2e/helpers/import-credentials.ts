import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reads the one-time credentials file produced by
 * scripts/import-private-data.ts --apply (git-ignored, never committed —
 * see .gitignore's `*credentials*.csv` entry) so Playwright specs can
 * log in as real imported teachers/parents/children instead of the old
 * demo accounts (teacher@ecostart.local etc.), which no longer exist —
 * item 1's cutover rule removed every non-Excel person from the DB.
 *
 * Picks the first row per role (by CSV row order, which is itself
 * deterministic for a given Excel file — see import-private-data.ts),
 * so re-running --apply against the same private-data/1.xlsx always
 * yields the same "first" pick for these specs.
 */

export type ImportedCredential = {
  role: "TEACHER" | "PARENT" | "CHILD";
  displayName: string;
  loginIdentifier: string;
  plainSecret: string;
  groupCode: string;
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

let cached: ImportedCredential[] | null = null;

export function readImportCredentials(): ImportedCredential[] {
  if (cached) return cached;
  const csvPath = path.join(process.cwd(), "private-data", "import-credentials.csv");
  let content: string;
  try {
    content = readFileSync(csvPath, "utf8");
  } catch {
    throw new Error(
      `${csvPath} табылмады. Алдымен "npx tsx scripts/import-private-data.ts --apply" іске қосыңыз.`
    );
  }
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const [, ...rows] = lines;
  cached = rows.map((line) => {
    const [role, displayName, loginIdentifier, plainSecret, groupCode] = parseCsvLine(line);
    return { role: role as ImportedCredential["role"], displayName, loginIdentifier, plainSecret, groupCode };
  });
  return cached;
}

function firstOfRole(role: ImportedCredential["role"]): ImportedCredential {
  const row = readImportCredentials().find((r) => r.role === role);
  if (!row) throw new Error(`private-data/import-credentials.csv ішінде "${role}" жазбасы табылмады.`);
  return row;
}

export const getFirstTeacherCredential = () => firstOfRole("TEACHER");
export const getFirstParentCredential = () => firstOfRole("PARENT");
export const getFirstChildCredential = () => firstOfRole("CHILD");
