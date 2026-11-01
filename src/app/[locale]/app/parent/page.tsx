import { getTranslations, setRequestLocale } from "next-intl/server";
import { Camera, FlaskConical, Gamepad2, Sprout } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getLinkedChildren, getWeeklyStats } from "@/db/repo/family";
import { getRecentActivities } from "@/db/repo/passport";
import { getRecentPhotosForParent } from "@/db/repo/ecolab";
import { ChildPhoto } from "@/components/child-photo";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON = { recognition: Camera, game: Gamepad2, growth: Sprout, research: FlaskConical } as const;

export default async function ParentOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const { locale } = await params;
  const { child: childParam } = await searchParams;
  setRequestLocale(locale);
  const session = await requireRole("PARENT");
  const ctx = toTenantContext(session);
  const children = await getLinkedChildren(ctx);
  const t = await getTranslations("family");
  const tCommon = await getTranslations("common");

  if (children.length === 0) {
    return <p className="text-muted-foreground">—</p>;
  }

  const activeChild = children.find((c) => c.id === childParam) ?? children[0];
  const [stats, activities, photos] = await Promise.all([
    getWeeklyStats(ctx, activeChild.id),
    getRecentActivities(ctx, activeChild.id, 8),
    getRecentPhotosForParent(ctx, activeChild.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {activeChild.displayName} · {t("subtitle")}
        </p>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              href={{ pathname: "/app/parent", query: { child: c.id } }}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-semibold",
                c.id === activeChild.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-card"
              )}
            >
              {c.displayName}
            </Link>
          ))}
        </div>
      )}

      <Card className="border-none bg-primary text-primary-foreground shadow-md">
        <CardContent className="flex flex-col gap-1 pt-2">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-90">{t("weekSummary")}</p>
          <div className="flex items-center gap-4 text-lg font-bold">
            <span>{t("xpGained", { xp: stats.xpGained })}</span>
            <span>{t("newBadges", { count: stats.newBadges })}</span>
          </div>
          <p className="text-sm opacity-90">
            {tCommon("level")} {activeChild.level} • {activeChild.xp} XP {tCommon("all")}
          </p>
        </CardContent>
      </Card>

      {photos.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-bold">Эко Зертхана суреттері</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.map((p) => (
              <figure key={p.id} className="flex flex-col gap-1">
                <ChildPhoto src={p.imageUrl} alt={p.label ?? ""} className="aspect-square w-full rounded-xl bg-muted object-cover" />
                <figcaption className="truncate text-[11px] text-muted-foreground">{p.label ?? "—"}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-heading text-lg font-bold">{t("recentActivity")}</h2>
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
