import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getEntry, getGrowthLogs } from "@/db/repo/greenhouse";
import { GrowthChart } from "@/components/child/growth-chart";
import { AddObservationForm } from "@/components/child/add-observation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function GreenhouseEntryPage({
  params,
}: {
  params: Promise<{ locale: string; entryId: string }>;
}) {
  const { locale, entryId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);
  const entry = await getEntry(ctx, entryId);
  if (!entry) notFound();

  const logs = await getGrowthLogs(ctx, entryId);
  const t = await getTranslations("greenhouse");

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold">{entry.nickname}</h1>
        <Badge variant="outline">{t(`status.${entry.status}`)}</Badge>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <h2 className="mb-2 font-heading text-sm font-bold text-muted-foreground">
            {t("growthChart")}
          </h2>
          <GrowthChart logs={logs} />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <AddObservationForm locale={locale} entryId={entryId} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {[...logs].reverse().map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm"
          >
            <span className="text-muted-foreground">{log.loggedAt}</span>
            <span className="font-semibold">{log.heightCm != null ? `${log.heightCm} cm` : "—"}</span>
            <span className="max-w-[50%] truncate text-muted-foreground">{log.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
