// Deliberately no "server-only" import — used from both the data layer
// (src/db/repo/news.ts) and the client-side admin editor
// (src/components/super-admin/news-editor.tsx), and needs to be
// directly unit-testable (server-only throws outside the Next.js build
// system — see this file's test for why that rules out testing it via
// either of those two importers directly).

type NewsMediaFields = {
  gallery_urls?: unknown;
  video_urls?: unknown;
  main_video_url?: unknown;
};

/**
 * Guards a news row's optional media fields against anything other
 * than a real array/null: `undefined` (the jsonb column absent from
 * the row entirely — e.g. a row read before migration
 * 0013_news_video.sql has run against this database), `null` (jsonb
 * `null` instead of `[]`), or any other malformed value. Every
 * consumer (news-editor.tsx, the public news list/article pages) calls
 * .map()/.filter()/.length/spread directly on gallery_urls/video_urls,
 * so this is applied once at the two points data enters those
 * consumers (the repo functions in news.ts, and React state in
 * news-editor.tsx) rather than guarded at every call site.
 */
type NormalizedMediaFields = { gallery_urls: string[]; video_urls: string[]; main_video_url: string | null };

export function normalizeNewsMediaFields<T extends NewsMediaFields>(
  row: T
): Omit<T, "gallery_urls" | "video_urls" | "main_video_url"> & NormalizedMediaFields {
  return {
    ...row,
    gallery_urls: Array.isArray(row.gallery_urls) ? (row.gallery_urls as string[]) : [],
    video_urls: Array.isArray(row.video_urls) ? (row.video_urls as string[]) : [],
    main_video_url: (row.main_video_url as string | null | undefined) ?? null,
  };
}
