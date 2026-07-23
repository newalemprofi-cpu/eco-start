import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getPrimaryGroup } from "@/db/repo/teacher";
import { getGroupAnalytics } from "@/db/repo/analytics";
import { XpBarChart } from "@/components/teacher/xp-bar-chart";
import { Card, CardContent } from "@/components/ui/card";

export default async function TeacherReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);
  const group = await getPrimaryGroup(ctx);
  const t = await getTranslations("analytics");

  if (!group) return <p className="text-muted-foreground">—</p>;

  const analytics = await getGroupAnalytics(ctx, group.id);

  const stats = [
    { label: t("groupXp"), value: analytics.avgXp },
    { label: t("activeChildren"), value: `${analytics.activeChildren}/${analytics.totalChildren}` },
    { label: t("gameEngagement"), value: analytics.gameSessions },
    { label: t("researchProgress"), value: analytics.researchObservations },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("subtitle")}: {group.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60 shadow-sm">
            <CardContent className="pt-2">
              <p className="text-2xl font-heading font-extrabold text-module-analytics">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <h2 className="mb-2 font-heading text-sm font-bold text-muted-foreground">XP</h2>
          <XpBarChart data={analytics.xpByChild} />
        </CardContent>
      </Card>
    </div>
  );
}
