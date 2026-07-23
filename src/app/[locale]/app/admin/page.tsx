import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getSchoolOverview } from "@/db/repo/admin";
import { listAuditLogs } from "@/db/repo/audit";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SCHOOL_ADMIN");
  const ctx = toTenantContext(session);
  const [counts, logs] = await Promise.all([getSchoolOverview(ctx), listAuditLogs(ctx, 8)]);
  const t = await getTranslations("admin");

  const stats = [
    { label: t("teachersTitle"), value: counts.teachers },
    { label: t("childrenTitle"), value: counts.children },
    { label: t("parentsTitle"), value: counts.parents },
    { label: t("aiUsage"), value: counts.aiCalls },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-extrabold">{t("overviewTitle")}</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60 shadow-sm">
            <CardContent className="pt-2">
              <p className="font-heading text-2xl font-extrabold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">{t("auditTitle")}</h2>
        <div className="mt-3 flex flex-col gap-1.5">
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-2 text-sm"
            >
              <span>
                <strong>{l.actorName ?? "жүйе"}</strong> {l.action} {l.entityType}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(l.createdAt).toLocaleString(locale)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
