import { getTranslations, setRequestLocale } from "next-intl/server";
import { Award, Camera, Download, FlaskConical, Gamepad2, Sprout } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getChildSummary } from "@/db/repo/child";
import { getAllBadgesWithStatus, getCertificates, getRecentActivities } from "@/db/repo/passport";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { levelIntoCurrentLevelLabel } from "@/lib/domain/xp-format";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON = { recognition: Camera, game: Gamepad2, growth: Sprout, research: FlaskConical } as const;

export default async function PassportPage({
  params,
}: {
  params: Promise<{ locale: "kk" | "ru" | "en" }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  const [summary, badges, certificates, activities] = await Promise.all([
    getChildSummary(ctx),
    getAllBadgesWithStatus(ctx),
    getCertificates(ctx),
    getRecentActivities(ctx),
  ]);

  const t = await getTranslations("passport");
  const tCommon = await getTranslations("common");
  const { progressPercent, xpLabel } = levelIntoCurrentLevelLabel(summary.xp);

  return (
    <div className="flex flex-col gap-8 pt-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="overflow-hidden border-none bg-module-passport text-white shadow-md">
        <CardContent className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-3">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/20 text-3xl">
              {summary.avatarUrl ?? "🦉"}
            </span>
            <div>
              <p className="font-heading text-xl font-bold">{summary.displayName}</p>
              <p className="text-sm opacity-90">
                {tCommon("level")} {summary.level} • {summary.xp} XP
              </p>
            </div>
          </div>
          <Progress value={progressPercent} className="h-3 [&_[data-slot=progress-indicator]]:bg-white" />
          <p className="text-xs opacity-90">{xpLabel}</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-heading text-lg font-bold">{t("badgesTitle")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b) => {
            const earned = Boolean(b.earnedAt);
            return (
              <div
                key={b.id}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center shadow-sm transition duration-300 ${
                  earned
                    ? "animate-in zoom-in-90 border-module-passport/40 bg-module-passport/10 hover:-translate-y-0.5"
                    : "border-border/60 bg-muted/40 opacity-50"
                }`}
              >
                <Award className={`size-7 ${earned ? "text-module-passport" : "text-muted-foreground"}`} />
                <span className="text-xs font-bold">{b.title[locale] ?? b.title.kk}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">{t("certificatesTitle")}</h2>
        {certificates.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border/60 py-8 text-center">
            <span className="text-5xl" aria-hidden>
              🏆
            </span>
            <p className="text-sm text-muted-foreground">{t("noCertificates")}</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {certificates.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{c.title[locale] ?? c.title.kk}</p>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
                <a
                  href={`/api/certificates/${c.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
                >
                  <Download className="size-3.5" />
                  {t("downloadCertificate")}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">{t("activitiesTitle")}</h2>
        <div className="mt-3 flex flex-col gap-1.5">
          {activities.map((a, i) => {
            const Icon = ACTIVITY_ICON[a.kind];
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm"
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{a.label}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.occurredAt).toLocaleDateString(locale)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
