// Client-safe labels for lessons.status — shared by the teacher's
// library (client component) and lesson page (server component).
export type LessonStatus = "draft" | "published" | "archived";

export const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  draft: "Жоба",
  published: "Жарияланған",
  archived: "Архивте",
};
