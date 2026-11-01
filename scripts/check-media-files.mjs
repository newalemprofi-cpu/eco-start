#!/usr/bin/env node
/**
 * READ-ONLY media diagnosis: for every photo/video URL stored in the
 * database, does the file actually exist under UPLOAD_ROOT?
 *
 * Plain Node (no tsx needed), so it runs inside the production app
 * container:  node scripts/check-media-files.mjs
 *
 * Safety: the whole session runs in a READ ONLY transaction and only
 * issues SELECTs; nothing is written to the database or the disk.
 * Output contains counts and storage keys (uuids + timestamps) — no
 * names, no e-mails, no secrets. The connection string is never printed.
 *
 * Exit code: 0 = every local file present, 1 = some are missing, 2 = error.
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

try {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  config();
} catch {
  // dotenv is optional — in the container the env is already set.
}

const connectionString = process.env.DATABASE_URL || process.env.APP_DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL / APP_DATABASE_URL орнатылмаған.");
  process.exit(2);
}

const uploadRoot = process.env.UPLOAD_ROOT?.trim() || path.join(process.cwd(), "public", "uploads");
const r2Base = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, "") || null;
const MAX_LIST = Number(process.env.MEDIA_CHECK_LIST || 20);

const PRIVATE = new Set(["recognitions", "media"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE = /^\d{1,16}\.(jpg|jpeg|png|webp)$/i;

/** Same rules as src/lib/storage/media-access.ts → classifyMediaKey. */
function classify(url) {
  if (!url) return { type: "empty" };
  let key = null;
  if (url.startsWith("/uploads/")) key = url.slice("/uploads/".length);
  else if (r2Base && url.startsWith(`${r2Base}/`)) return { type: "r2", key: url.slice(r2Base.length + 1) };
  else if (/^https?:\/\//i.test(url)) return { type: "external" };
  else return { type: "other" };
  const segs = key.split("/").filter(Boolean);
  if (PRIVATE.has(segs[0]?.toLowerCase())) {
    const [first, school, child, file, ...rest] = segs;
    const ok = first === first.toLowerCase() && rest.length === 0 && UUID.test(school ?? "") && UUID.test(child ?? "") && FILE.test(file ?? "");
    if (!ok) return { type: "invalid_private", key };
  }
  return { type: "local", key, private: PRIVATE.has(segs[0]?.toLowerCase()) };
}

const SOURCES = [
  { label: "Эко Зертхана (recognitions.image_url)", query: (sql) => sql`select image_url as url from recognitions` },
  { label: "Студия (media_assets.file_url)", query: (sql) => sql`select file_url as url from media_assets where file_url is not null` },
  { label: "Студия (media_assets.thumbnail_url)", query: (sql) => sql`select thumbnail_url as url from media_assets where thumbnail_url is not null` },
  { label: "Бөбекжай (growth_logs.photo_url)", query: (sql) => sql`select photo_url as url from growth_logs where photo_url is not null` },
  { label: "Зерттеу (research_observations.photo_url)", query: (sql) => sql`select photo_url as url from research_observations where photo_url is not null` },
  { label: "Жаңалықтар (news_items.main_image_url)", query: (sql) => sql`select main_image_url as url from news_items where main_image_url is not null` },
  {
    label: "Жаңалықтар (news_items.gallery_urls)",
    query: (sql) => sql`select jsonb_array_elements_text(case when jsonb_typeof(gallery_urls) = 'array' then gallery_urls else '[]'::jsonb end) as url from news_items`,
  },
];

function mountInfo(dir) {
  try {
    if (!existsSync(dir)) return "ЖОҚ (каталог табылмады)";
    const own = statSync(dir).dev;
    const parent = statSync(path.dirname(dir)).dev;
    return own !== parent
      ? "бөлек құрылғы — persistent volume сияқты ✅"
      : "контейнердің өз дискісінде — volume қосылмаған болуы мүмкін ⚠️ (redeploy кезінде файлдар жоғалады)";
  } catch {
    return "тексеру мүмкін болмады";
  }
}

const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
let anyMissing = false;
try {
  console.log(`UPLOAD_ROOT: ${uploadRoot}`);
  console.log(`UPLOAD_ROOT орны: ${mountInfo(uploadRoot)}`);
  console.log(`STORAGE_DRIVER: ${process.env.STORAGE_DRIVER || "local (әдепкі)"}${r2Base ? " · R2_PUBLIC_URL бар" : ""}`);
  console.log("");

  await sql.begin("read only", async (tx) => {
    let totalRows = 0;
    for (const source of SOURCES) {
      let rows;
      try {
        rows = await source.query(tx);
      } catch (err) {
        console.log(`• ${source.label}: оқу мүмкін болмады (${err.code ?? "error"})`);
        continue;
      }
      totalRows += rows.length;
      const counts = { present: 0, missing: 0, invalid_private: 0, r2: 0, external: 0, other: 0, empty: 0 };
      const missing = [];
      for (const { url } of rows) {
        const c = classify(url);
        if (c.type === "local") {
          if (existsSync(path.join(uploadRoot, ...c.key.split("/")))) counts.present++;
          else {
            counts.missing++;
            if (missing.length < MAX_LIST) missing.push(c.key);
          }
        } else counts[c.type]++;
      }
      if (rows.length === 0) {
        console.log(`• ${source.label}: жазба жоқ`);
        continue;
      }
      console.log(
        `• ${source.label}: барлығы ${rows.length} · файл бар ${counts.present} · ФАЙЛ ЖОҚ ${counts.missing}` +
          (counts.invalid_private ? ` · пішімі қате ${counts.invalid_private}` : "") +
          (counts.r2 ? ` · R2 (тексерілмеді) ${counts.r2}` : "") +
          (counts.external ? ` · сыртқы URL ${counts.external}` : "") +
          (counts.other ? ` · басқа ${counts.other}` : "")
      );
      for (const key of missing) console.log(`    жоқ: ${key}`);
      if (counts.missing > missing.length) console.log(`    … тағы ${counts.missing - missing.length}`);
      if (counts.missing) anyMissing = true;
    }
    if (totalRows === 0) {
      console.log("\n⚠️  Бірде-бір жазба оқылмады. APP_DATABASE_URL (RLS) арқылы қосылған болсаңыз, DATABASE_URL-мен қайталаңыз.");
    }
  });
} catch (err) {
  console.error(`Қате: ${err.message}`);
  process.exitCode = 2;
} finally {
  await sql.end({ timeout: 5 });
}
if (process.exitCode !== 2) process.exitCode = anyMissing ? 1 : 0;
