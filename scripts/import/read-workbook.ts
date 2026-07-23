/**
 * Thin I/O wrapper around the `xlsx` (SheetJS) library — the only file
 * in scripts/import/ that touches the filesystem, kept separate from
 * parse-excel.ts so the actual parsing/mapping logic stays unit-testable
 * without needing a real .xlsx file on disk.
 */
import XLSX from "xlsx";
import type { RawChildRow } from "./parse-excel";

export type WorkbookSummary = {
  sheetNames: string[];
  rows: RawChildRow[];
};

const EXPECTED_SHEET_NAMES = ["Бала", "ата-ана", "педагог"];
const DATA_SHEET_NAME = "Бала";

export function readPrivateDataWorkbook(filePath: string): WorkbookSummary {
  const wb = XLSX.readFile(filePath, { cellDates: true });

  if (wb.SheetNames.length !== EXPECTED_SHEET_NAMES.length) {
    throw new Error(
      `Күтілген парақ саны ${EXPECTED_SHEET_NAMES.length}, нақтысы ${wb.SheetNames.length}: [${wb.SheetNames.join(", ")}]`
    );
  }
  for (const name of EXPECTED_SHEET_NAMES) {
    if (!wb.SheetNames.includes(name)) {
      throw new Error(`Күтілген "${name}" парағы табылмады. Бар парақтар: [${wb.SheetNames.join(", ")}]`);
    }
  }

  const ws = wb.Sheets[DATA_SHEET_NAME];
  const raw = XLSX.utils.sheet_to_json<Record<string, string | null>>(ws, { defval: null, raw: false });

  const rows: RawChildRow[] = raw.map((r, i) => ({
    child: (r["Бала"] ?? "").toString(),
    parent: (r["Ата-ана"] ?? "").toString(),
    groupText: (r["тобы "] ?? "").toString(),
    pedagogText: (r["Педагог"] ?? "").toString(),
    // +2: 1 for the 1-indexed header row, 1 for sheet_to_json's 0-indexed array
    excelRowNumber: i + 2,
  }));

  return { sheetNames: wb.SheetNames, rows };
}
