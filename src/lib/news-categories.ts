// Client-safe home for the news category enum. news-editor.tsx ("use
// client") needs this as a runtime value; importing it from
// db/repo/news.ts directly would drag that file's `server-only` +
// postgres client into the browser bundle (banners-editor.tsx avoids
// the same trap by only ever importing `type`s from its repo file).
export const NEWS_CATEGORIES = [
  "events",
  "eco_projects",
  "child_achievements",
  "teacher_news",
  "for_parents",
  "announcements",
] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
