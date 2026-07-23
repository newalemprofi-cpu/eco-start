import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getJournal } from "@/db/repo/ecolab";
import { EcoLabUploader } from "@/components/child/ecolab-uploader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function EcoLabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const journal = await getJournal(toTenantContext(session));
  const t = await getTranslations("ecolab");

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <EcoLabUploader locale={locale} />

      <div>
        <h2 className="font-heading text-lg font-bold">{t("journalTitle")}</h2>
        {journal.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border/60 py-8 text-center">
            <span className="text-5xl" aria-hidden>
              📷
            </span>
            <p className="text-sm text-muted-foreground">{t("journalEmpty")}</p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {journal.map((entry) => (
              <Card key={entry.id} className="overflow-hidden border-border/60 py-0 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.imageUrl} alt="" className="h-24 w-full bg-muted object-cover" />
                <CardContent className="flex flex-col gap-1 px-3 py-2.5">
                  <span className="truncate text-sm font-semibold">{entry.label ?? "?"}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(entry.confidence * 100)}%
                    </Badge>
                    {entry.isPotentiallyToxic && <ShieldAlert className="size-3.5 text-destructive" />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
