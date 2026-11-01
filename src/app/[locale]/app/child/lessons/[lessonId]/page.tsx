import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getLessonForChild } from "@/db/repo/lessons";
import { lessonIdSchema } from "@/lib/validation/lessons";
import { Link } from "@/i18n/navigation";
import { ChildLessonView } from "@/components/child/child-lesson-view";

export default async function ChildLessonPage({
  params,
}: {
  params: Promise<{ locale: string; lessonId: string }>;
}) {
  const { locale, lessonId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  if (!lessonIdSchema.safeParse(lessonId).success) notFound();
  // Scoped to the child's own group + published status in the query —
  // another group's lesson id 404s here.
  const lesson = await getLessonForChild(toTenantContext(session), lessonId);
  if (!lesson) notFound();

  return (
    <div className="flex flex-col gap-4 pt-4">
      <Link
        href="/app/child/lessons"
        aria-label="Артқа"
        className="flex size-14 items-center justify-center rounded-2xl border-2 border-border/60 bg-card"
      >
        <ArrowLeft className="size-7" />
      </Link>
      <ChildLessonView topic={lesson.topic} content={lesson.content} />
    </div>
  );
}
