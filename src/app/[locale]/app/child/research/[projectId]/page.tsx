import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getObservations, getProjectForChild } from "@/db/repo/research";
import { ResearchChart } from "@/components/research-chart";
import { AddObservationResearchForm } from "@/components/child/add-observation-research-form";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TASK_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ResearchProjectPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  if (!UUID_RE.test(projectId)) notFound();
  // Own group only, never drafts — another group's project id 404s.
  const project = await getProjectForChild(ctx, projectId);
  if (!project) notFound();

  const observations = await getObservations(ctx, projectId);
  const mine = observations.filter((o) => o.childId === session.userId);
  const t = await getTranslations("research");

  return (
    <div className="flex flex-col gap-6 pt-4">
      <Link
        href="/app/child/research"
        aria-label="Артқа"
        className="flex size-14 items-center justify-center rounded-2xl border-2 border-border/60 bg-card"
      >
        <ArrowLeft className="size-7" />
      </Link>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-2xl font-extrabold">🔬 {project.title}</h1>
          <Badge variant="outline">{t(`status.${project.status}`)}</Badge>
        </div>
        <p className="mt-2 text-lg">❓ {project.question}</p>
        <p className="mt-1 text-muted-foreground">💡 {project.hypothesis}</p>
      </div>

      {project.tasks.length > 0 && (
        <ol className="grid gap-2 sm:grid-cols-2">
          {project.tasks.map((task, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border-2 border-border/60 bg-card p-4 text-lg">
              <span className="text-3xl" aria-hidden>
                {TASK_EMOJI[i] ?? "⭐"}
              </span>
              {task}
            </li>
          ))}
        </ol>
      )}

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <AddObservationResearchForm
            locale={locale}
            projectId={projectId}
            unit={project.measurementUnit}
            disabled={project.status !== "active"}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <h2 className="mb-2 font-heading text-sm font-bold text-muted-foreground">{t("chartTitle")}</h2>
          <ResearchChart observations={observations} />
        </CardContent>
      </Card>

      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-bold">⭐ Менің бақылауларым</h2>
          {[...mine].reverse().map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3">
              <span className="text-muted-foreground">{new Date(o.loggedAt).toLocaleDateString(locale)}</span>
              <span className="font-bold">{o.measurement != null ? `${o.measurement} ${project.measurementUnit}` : ""}</span>
              <span>{o.note ?? ""}</span>
            </div>
          ))}
        </div>
      )}

      {project.conclusion && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <p className="text-xs font-semibold uppercase text-success">{t("conclusion")}</p>
          <p className="mt-1">{project.conclusion}</p>
        </div>
      )}

      {project.teacherFeedback && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase text-primary">{t("teacherFeedback")}</p>
          <p className="mt-1">{project.teacherFeedback}</p>
        </div>
      )}
    </div>
  );
}
