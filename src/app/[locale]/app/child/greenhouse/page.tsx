import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sprout } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listEntries } from "@/db/repo/greenhouse";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddPlantDialog } from "@/components/child/add-plant-dialog";
import { WaterButton } from "@/components/child/water-button";
import type { AppLocale } from "@/i18n/routing";

export default async function GreenhousePage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const entries = await listEntries(toTenantContext(session));
  const t = await getTranslations("greenhouse");

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <AddPlantDialog locale={locale} />
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border/60 py-8 text-center">
          <span className="text-5xl" aria-hidden>
            🌱
          </span>
          <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-border/60 shadow-sm">
              <CardContent className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between">
                  <Link href={`/app/child/greenhouse/${entry.id}`} className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-module-greenhouse/15 text-module-greenhouse">
                      <Sprout className="size-4.5" />
                    </span>
                    <span className="font-heading font-bold">{entry.nickname}</span>
                  </Link>
                  <Badge variant="outline">{t(`status.${entry.status}`)}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {entry.latestHeightCm != null ? `${entry.latestHeightCm} cm` : "—"}
                  </span>
                  <span>
                    {t("lastWatered")}: {entry.lastWateredAt ?? "—"}
                  </span>
                </div>
                <WaterButton locale={locale} entryId={entry.id} label={t("markWatered")} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
