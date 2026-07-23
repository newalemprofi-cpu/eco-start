import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getPrimaryGroup } from "@/db/repo/teacher";
import { getObservations, listProjectsForGroup } from "@/db/repo/research";
import { ResearchChart } from "@/components/research-chart";
import { CreateProjectDialog } from "@/components/teacher/create-project-dialog";
import { FeedbackForm } from "@/components/teacher/feedback-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TeacherResearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);
  const group = await getPrimaryGroup(ctx);
  const t = await getTranslations("research");

  if (!group) return <p className="text-muted-foreground">—</p>;

  const projects = await listProjectsForGroup(ctx, group.id);
  const observationsByProject = await Promise.all(
    projects.map((p) => getObservations(ctx, p.id))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <CreateProjectDialog locale={locale} />
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {projects.map((p, i) => (
            <Card key={p.id} className="border-border/60 shadow-sm">
              <CardContent className="flex flex-col gap-3 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-bold">{p.title}</h2>
                  <Badge variant="outline">{t(`status.${p.status}`)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{p.question}</p>
                <ResearchChart observations={observationsByProject[i]} />
                <FeedbackForm locale={locale} projectId={p.id} initialValue={p.teacherFeedback} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
