import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getObservations, getProject } from "@/db/repo/research";
import { ResearchChart } from "@/components/research-chart";
import { AddObservationResearchForm } from "@/components/child/add-observation-research-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ResearchProjectPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  const project = await getProject(ctx, projectId);
  if (!project) notFound();

  const observations = await getObservations(ctx, projectId);
  const t = await getTranslations("research");

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-extrabold">{project.title}</h1>
          <Badge variant="outline">{t(`status.${project.status}`)}</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">{project.question}</p>
        <p className="mt-1 text-sm italic text-muted-foreground">{project.hypothesis}</p>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <h2 className="mb-2 font-heading text-sm font-bold text-muted-foreground">
            {t("chartTitle")}
          </h2>
          <ResearchChart observations={observations} />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <AddObservationResearchForm locale={locale} projectId={projectId} unit={project.measurementUnit} />
        </CardContent>
      </Card>

      {project.teacherFeedback && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase text-primary">{t("teacherFeedback")}</p>
          <p className="mt-1 text-sm">{project.teacherFeedback}</p>
        </div>
      )}
    </div>
  );
}
