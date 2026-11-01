import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listTeacherGroups } from "@/db/repo/teacher";
import {
  ACTIVE_WINDOW_DAYS,
  ACTIVITY_WINDOW_DAYS,
  getChildActivityTable,
  getGameBreakdown,
  getGroupAnalytics,
  getResearchBreakdown,
} from "@/db/repo/analytics";
import { Link } from "@/i18n/navigation";
import { XpBarChart } from "@/components/teacher/xp-bar-chart";
import { ActivityBars } from "@/components/teacher/activity-bars";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VIEWS = ["active", "xp", "games", "research"] as const;
type View = (typeof VIEWS)[number];

function relativeDay(iso: string | null, locale: string): string {
  if (!iso) return "әлі жоқ";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "бүгін";
  if (days === 1) return "кеше";
  if (days < 7) return `${days} күн бұрын`;
  return new Date(iso).toLocaleDateString(locale);
}

export default async function TeacherReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ group?: string; view?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);
  const t = await getTranslations("analytics");

  const groups = await listTeacherGroups(ctx);
  if (groups.length === 0) {
    return <p className="text-muted-foreground">Сізге әлі топ бекітілмеген — есеп топ бойынша құрылады.</p>;
  }
  // Only one of the teacher's own groups can be selected — an unknown
  // ?group= silently falls back to the first, never to another group.
  const group = groups.find((g) => g.id === query.group) ?? groups[0];
  const view: View = (VIEWS as readonly string[]).includes(query.view ?? "") ? (query.view as View) : "active";

  const [analytics, children, gameRows, researchRows] = await Promise.all([
    getGroupAnalytics(ctx, group.id),
    getChildActivityTable(ctx, group.id),
    getGameBreakdown(ctx, group.id),
    getResearchBreakdown(ctx, group.id),
  ]);

  const stats: { view: View; label: string; value: string | number; hint: string }[] = [
    { view: "active", label: t("activeChildren"), value: `${analytics.activeChildren}/${analytics.totalChildren}`, hint: `соңғы ${ACTIVE_WINDOW_DAYS} күн` },
    { view: "xp", label: t("groupXp"), value: analytics.avgXp, hint: "бір балаға" },
    { view: "games", label: t("gameEngagement"), value: analytics.gameSessions, hint: "аяқталған ойын" },
    { view: "research", label: t("researchProgress"), value: analytics.researchObservations, hint: "бақылау" },
  ];

  const href = (next: { view?: View; group?: string }) =>
    `/app/teacher/reports?group=${next.group ?? group.id}&view=${next.view ?? view}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("subtitle")}: {group.name} ({group.code})
        </p>
        {groups.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <Link key={g.id} href={href({ group: g.id })}>
                <Badge variant={g.id === group.id ? "default" : "outline"}>{g.name}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.view} href={href({ view: s.view })} aria-current={view === s.view ? "true" : undefined}>
            <Card
              className={cn(
                "h-full border-border/60 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                view === s.view && "border-module-analytics ring-2 ring-module-analytics/30"
              )}
            >
              <CardContent className="flex items-center gap-2 pt-2">
                <div className="flex-1">
                  <p className="font-heading text-2xl font-extrabold text-module-analytics">{s.value}</p>
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.hint}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <h2 className="mb-2 font-heading text-sm font-bold text-muted-foreground">
            Топ белсенділігі — соңғы {ACTIVITY_WINDOW_DAYS} күн
          </h2>
          <ActivityBars
            tall
            values={analytics.activityByDay.map((d) => d.actions)}
            labels={analytics.activityByDay.map((d) => d.day)}
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{analytics.activityByDay[0]?.day}</span>
            <span>{analytics.activityByDay.at(-1)?.day}</span>
          </div>
        </CardContent>
      </Card>

      {view === "active" && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <h2 className="mb-3 font-heading font-bold">Балалар белсенділігі</h2>
            {children.length === 0 ? (
              <p className="text-sm text-muted-foreground">Топта әлі бала жоқ.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-3">Бала</th>
                      <th className="py-1.5 pr-3">Ойын</th>
                      <th className="py-1.5 pr-3">Зерттеу</th>
                      <th className="py-1.5 pr-3">Зертхана</th>
                      <th className="py-1.5 pr-3">XP</th>
                      <th className="py-1.5 pr-3">Белгі</th>
                      <th className="py-1.5 pr-3">Соңғы әрекет</th>
                      <th className="py-1.5">Динамика ({ACTIVITY_WINDOW_DAYS} күн)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((c) => (
                      <tr key={c.id} className="border-t border-border/40">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/app/teacher/reports/child/${c.id}`}
                            className="flex items-center gap-2 font-medium hover:underline"
                          >
                            <span className={cn("size-2 rounded-full", c.isActive ? "bg-success" : "bg-muted-foreground/40")} />
                            {c.displayName}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {c.gamesPlayed} <span className="text-xs text-muted-foreground">({c.distinctGames} түрі)</span>
                        </td>
                        <td className="py-2 pr-3">{c.researchObservations}</td>
                        <td className="py-2 pr-3">{c.recognitions}</td>
                        <td className="py-2 pr-3">
                          {c.xp} <span className="text-xs text-muted-foreground">· {c.level}-дең.</span>
                        </td>
                        <td className="py-2 pr-3">{c.achievements}</td>
                        <td className="py-2 pr-3 text-xs">{relativeDay(c.lastActivityAt, locale)}</td>
                        <td className="w-40 py-2">
                          <ActivityBars values={c.daily} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === "xp" && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <h2 className="mb-2 font-heading font-bold">XP бойынша балалар</h2>
            {analytics.xpByChild.length === 0 ? (
              <p className="text-sm text-muted-foreground">Топта әлі бала жоқ.</p>
            ) : (
              <XpBarChart data={analytics.xpByChild} />
            )}
          </CardContent>
        </Card>
      )}

      {view === "games" && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <h2 className="mb-3 font-heading font-bold">Ойындар бойынша</h2>
            {gameRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Бұл топ әлі ойын аяқтаған жоқ.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {gameRows.map((g) => (
                  <div key={g.gameId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-4 py-2.5 text-sm">
                    <span className="font-medium">{g.title[locale] ?? g.title.kk}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.sessions} рет · {g.children} бала · орташа {g.avgScore} ұпай
                    </span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Орташа ұпай (барлық ойын): {analytics.gameAvgScore}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === "research" && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <h2 className="mb-3 font-heading font-bold">Зерттеулер бойынша</h2>
            {researchRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Бұл топта зерттеу жоқ. <Link href="/app/teacher/research" className="underline">Жаңа зерттеу құру</Link>
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {researchRows.map((r) => (
                  <Link
                    key={r.projectId}
                    href="/app/teacher/research"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-4 py-2.5 text-sm hover:bg-muted/40"
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.observations} бақылау · {r.participants}/{analytics.totalChildren} бала · соңғысы{" "}
                      {relativeDay(r.lastObservationAt, locale)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
