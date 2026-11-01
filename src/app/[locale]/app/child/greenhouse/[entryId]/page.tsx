import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getEntry, getGrowthLogs } from "@/db/repo/greenhouse";
import { getChildAgeCategory } from "@/db/repo/child";
import { getPlant, maxLeavesForAge, PLANT_CATEGORY_INFO } from "@/lib/domain/plant-catalog";
import { Link } from "@/i18n/navigation";
import { GrowthChart } from "@/components/child/growth-chart";
import { AddObservationForm } from "@/components/child/add-observation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GreenhouseEntryPage({
  params,
}: {
  params: Promise<{ locale: string; entryId: string }>;
}) {
  const { locale, entryId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  if (!UUID_RE.test(entryId)) notFound();
  const entry = await getEntry(ctx, entryId);
  if (!entry) notFound();

  const [logs, ageCategory] = await Promise.all([getGrowthLogs(ctx, entryId), getChildAgeCategory(ctx)]);
  const t = await getTranslations("greenhouse");
  const plant = getPlant(entry.plantKey);
  const isYoungest = ageCategory === "MIDDLE_3";
  const reachedIndex = plant.stages.findIndex((s) => s.key === entry.latestStage);

  return (
    <div className="flex flex-col gap-6 pt-4">
      <Link
        href="/app/child/greenhouse"
        aria-label="Артқа"
        className="flex size-14 items-center justify-center rounded-2xl border-2 border-border/60 bg-card"
      >
        <ArrowLeft className="size-7" />
      </Link>

      <div className="flex items-center gap-4">
        <span className="flex size-20 items-center justify-center rounded-3xl bg-module-greenhouse/15 text-5xl">
          {plant.emoji}
        </span>
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{entry.nickname}</h1>
          <p className="text-sm text-muted-foreground">
            {PLANT_CATEGORY_INFO[plant.category].emoji} {PLANT_CATEGORY_INFO[plant.category].label} ·{" "}
            <Badge variant="outline">{t(`status.${entry.status}`)}</Badge>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 rounded-3xl bg-muted/40 p-4" aria-label="Өсу кезеңдері">
        {plant.stages.map((s, i) => (
          <div
            key={s.key}
            className={cn("flex flex-1 flex-col items-center gap-1", reachedIndex >= 0 && i > reachedIndex && "opacity-40")}
          >
            <span className={cn("text-4xl", i === reachedIndex && "scale-125")}>{s.emoji}</span>
            <span className="text-center text-[11px] font-semibold">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {plant.care.map((c) => (
          <span
            key={c.label}
            className="flex items-center gap-1.5 rounded-full border-2 border-border/60 bg-card px-3 py-1.5 text-sm font-semibold"
          >
            <span className="text-xl" aria-hidden>
              {c.emoji}
            </span>
            {c.label}
          </span>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <AddObservationForm
            locale={locale}
            entryId={entryId}
            stages={plant.stages}
            maxLeaves={maxLeavesForAge(isYoungest)}
            showHeight={!isYoungest}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <h2 className="mb-2 font-heading text-sm font-bold text-muted-foreground">{t("growthChart")}</h2>
          <GrowthChart logs={logs} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {[...logs].reverse().map((log) => {
          const stage = plant.stages.find((s) => s.key === log.stage);
          return (
            <div
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm"
            >
              <span className="text-muted-foreground">{new Date(log.loggedAt).toLocaleDateString(locale)}</span>
              {stage && (
                <span className="text-xl" title={stage.label}>
                  {stage.emoji}
                </span>
              )}
              {log.leafCount != null && <span aria-label={`${log.leafCount} жапырақ`}>🍃 × {log.leafCount}</span>}
              <span className="font-semibold">{log.heightCm != null ? `${log.heightCm} cm` : ""}</span>
              {log.note && <span className="max-w-[50%] truncate text-muted-foreground">{log.note}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
