import { getTranslations, setRequestLocale } from "next-intl/server";
import { Camera, FlaskConical, Gamepad2, Sprout } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getAssignments, getGroupActivity, getPrimaryGroup, getRoster } from "@/db/repo/teacher";
import { GROUP_AGE_CATEGORY_DESCRIPTION, GROUP_AGE_CATEGORY_LABEL } from "@/lib/group-age-categories";
import { Card, CardContent } from "@/components/ui/card";

const ACTIVITY_ICON = { recognition: Camera, game: Gamepad2, growth: Sprout, research: FlaskConical } as const;

export default async function TeacherOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);
  const group = await getPrimaryGroup(ctx);
  const t = await getTranslations("teacher");

  if (!group) {
    return <p className="text-muted-foreground">—</p>;
  }

  const [roster, activity, assignments] = await Promise.all([
    getRoster(ctx, group.id),
    getGroupActivity(ctx, group.id),
    getAssignments(ctx, group.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("overviewTitle")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("myGroup")}: {group.name} ({group.code}) — {GROUP_AGE_CATEGORY_LABEL[group.ageCategory]},{" "}
          {GROUP_AGE_CATEGORY_DESCRIPTION[group.ageCategory]} · Балалар саны: {group.childCount}
          {group.pedagogicalAssistantName && <> · Педагог-ассистент: {group.pedagogicalAssistantName}</>}
        </p>
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">{t("childProgress")}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((child) => (
            <Card key={child.id} className="border-border/60 shadow-sm">
              <CardContent className="flex items-center gap-3 pt-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-xl">
                  {child.avatarUrl ?? "🦉"}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{child.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Lvl {child.level} • {child.xp} XP
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-heading text-lg font-bold">{t("assignments")}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {assignments.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{a.topic}</span>
                <span className="text-xs text-muted-foreground">
                  {a.dueAt ? new Date(a.dueAt).toLocaleDateString(locale) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-heading text-lg font-bold">{t("recentActivity")}</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            {activity.map((a, i) => {
              const Icon = ACTIVITY_ICON[a.kind];
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="font-medium">{a.childName}</span>
                  <span className="flex-1 truncate text-muted-foreground">{a.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.occurredAt).toLocaleDateString(locale)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
