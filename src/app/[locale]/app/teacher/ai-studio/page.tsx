import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listLessons } from "@/db/repo/lessons";
import { listTeacherGroups } from "@/db/repo/teacher";
import { AiStudio, type StudioGroup } from "@/components/teacher/ai-studio";
import { LessonLibrary } from "@/components/teacher/lesson-library";

export default async function AiStudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);
  const [lessons, teacherGroups] = await Promise.all([listLessons(ctx), listTeacherGroups(ctx)]);
  const t = await getTranslations("teacher");

  const groups: StudioGroup[] = teacherGroups.map((g) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    ageCategory: g.ageCategory,
    childCount: g.childCount,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("aiStudioTitle")}</h1>
        <p className="mt-1 text-muted-foreground">{t("aiStudioSubtitle")}</p>
      </div>

      <AiStudio locale={locale} groups={groups} />

      {lessons.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-bold">{t("lessonLibrary")}</h2>
          <div className="mt-3">
            <LessonLibrary locale={locale} lessons={lessons} groups={groups} />
          </div>
        </div>
      )}
    </div>
  );
}
