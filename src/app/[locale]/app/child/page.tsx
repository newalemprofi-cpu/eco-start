import { getTranslations, setRequestLocale } from "next-intl/server";
import { Camera, Sparkles, Sprout, Trophy } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getRecentBadges } from "@/db/repo/child";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const QUESTS = [
  { key: "ecolab", href: "/app/child/ecolab", icon: Camera, color: "var(--module-ecolab)" },
  { key: "game", href: "/app/child/games/waste-sorting", icon: Trophy, color: "var(--module-game)" },
  { key: "greenhouse", href: "/app/child/greenhouse", icon: Sprout, color: "var(--module-greenhouse)" },
] as const;

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

export default async function ChildHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  const badges = await getRecentBadges(ctx, 4);

  const t = await getTranslations("child");
  const tModules = await getTranslations("modules");
  const tPassport = await getTranslations("passport");

  const quest = QUESTS[dayOfYear() % QUESTS.length];
  const QuestIcon = quest.icon;

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">
          {t("greeting", { name: session.displayName.split(" ")[0] })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("questionOfDay")}</p>
      </div>

      <Link href={quest.href}>
        <Card className="overflow-hidden border-none text-white shadow-md" style={{ background: quest.color }}>
          <CardContent className="flex items-center gap-4 pt-2">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <QuestIcon className="size-7" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                {t("quickActions")}
              </p>
              <p className="font-heading text-lg font-bold">{tModules(`${quest.key}.name`)}</p>
              <p className="text-sm opacity-90">{tModules(`${quest.key}.desc`)}</p>
            </div>
            <Sparkles className="ml-auto size-6 shrink-0 opacity-80" />
          </CardContent>
        </Card>
      </Link>

      <div>
        <h2 className="font-heading text-lg font-bold">{t("recentBadges")}</h2>
        {badges.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("noBadgesYet")}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3">
            {badges.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-module-passport/15 text-module-passport">
                  <Trophy className="size-4.5" />
                </span>
                <span className="text-sm font-semibold">
                  {b.title[locale] ?? b.title.kk ?? b.key}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/app/child/passport">
          <Badge variant="outline" className="mt-3">
            {tPassport("title")} →
          </Badge>
        </Link>
      </div>
    </div>
  );
}
