import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listLessons } from "@/db/repo/lessons";
import { AiStudio } from "@/components/teacher/ai-studio";
import { Badge } from "@/components/ui/badge";

export default async function AiStudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  const lessons = await listLessons(toTenantContext(session));
  const t = await getTranslations("teacher");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("aiStudioTitle")}</h1>
        <p className="mt-1 text-muted-foreground">{t("aiStudioSubtitle")}</p>
      </div>

      <AiStudio locale={locale} />

      {lessons.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-bold">{t("lessonLibrary")}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {lessons.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{l.topic}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={l.status === "published" ? "default" : "outline"}>{l.status}</Badge>
                  <span>{l.ageBand}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
