import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listTeacherGroups } from "@/db/repo/teacher";
import { getObservations, listProjectsForTeacher } from "@/db/repo/research";
import { ResearchChart } from "@/components/research-chart";
import { CreateProjectDialog } from "@/components/teacher/create-project-dialog";
import { FeedbackForm } from "@/components/teacher/feedback-form";
import { ResearchStatusControls } from "@/components/teacher/research-status-controls";
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
  const [groups, projects] = await Promise.all([listTeacherGroups(ctx), listProjectsForTeacher(ctx)]);
  const t = await getTranslations("research");

  const observationsByProject = await Promise.all(projects.map((p) => getObservations(ctx, p.id)));
  const dialogGroups = groups.map((g) => ({ id: g.id, name: g.name, code: g.code }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <CreateProjectDialog locale={locale} groups={dialogGroups} />
      </div>

      {groups.length === 0 && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          Сізге әлі топ бекітілмеген — зерттеу құру үшін меңгерушіден топқа бекітуді сұраңыз.
        </p>
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {projects.map((p, i) => {
            const observations = observationsByProject[i];
            const participants = new Set(observations.map((o) => o.childId)).size;
            return (
              <Card key={p.id} className="border-border/60 shadow-sm">
                <CardContent className="flex flex-col gap-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-heading font-bold">{p.title}</h2>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{p.groupName}</Badge>
                      <Badge variant={p.status === "active" ? "default" : "outline"}>{t(`status.${p.status}`)}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{p.question}</p>
                  <p className="text-sm italic text-muted-foreground">{p.hypothesis}</p>
                  {p.tasks.length > 0 && (
                    <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                      {p.tasks.map((task, j) => (
                        <li key={j}>{task}</li>
                      ))}
                    </ol>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {p.observationCount} бақылау · {participants} бала қатысты
                  </p>

                  <div className="flex flex-wrap items-start gap-2">
                    <CreateProjectDialog
                      locale={locale}
                      groups={dialogGroups}
                      initial={{
                        id: p.id,
                        groupId: p.groupId,
                        title: p.title,
                        question: p.question,
                        hypothesis: p.hypothesis,
                        measurementUnit: p.measurementUnit,
                        tasks: p.tasks,
                      }}
                    />
                    <ResearchStatusControls
                      locale={locale}
                      projectId={p.id}
                      status={p.status}
                      conclusion={p.conclusion}
                    />
                  </div>
                  {p.conclusion && (
                    <p className="text-sm">
                      <span className="font-semibold">{t("conclusion")}: </span>
                      {p.conclusion}
                    </p>
                  )}

                  <ResearchChart observations={observations} />

                  {observations.length > 0 && (
                    <details className="rounded-xl border border-border/60 px-3 py-2 text-sm">
                      <summary className="cursor-pointer font-semibold">Балалардың нәтижелері ({observations.length})</summary>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-3">Бала</th>
                              <th className="py-1 pr-3">Күні</th>
                              <th className="py-1 pr-3">Өлшем</th>
                              <th className="py-1">Ескерту</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...observations].reverse().map((o) => (
                              <tr key={o.id} className="border-t border-border/40">
                                <td className="py-1 pr-3 font-medium">{o.childName}</td>
                                <td className="py-1 pr-3">{new Date(o.loggedAt).toLocaleDateString(locale)}</td>
                                <td className="py-1 pr-3">
                                  {o.measurement != null ? `${o.measurement} ${p.measurementUnit}` : "—"}
                                </td>
                                <td className="py-1">{o.note ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}

                  <FeedbackForm locale={locale} projectId={p.id} initialValue={p.teacherFeedback} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
