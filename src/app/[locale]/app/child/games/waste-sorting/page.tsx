import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getGameHistory } from "@/db/repo/games";
import { WasteSortingGame } from "@/components/child/waste-sorting-game";
import type { AppLocale } from "@/i18n/routing";

export default async function WasteSortingPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const history = await getGameHistory(toTenantContext(session), "waste_sorting", 5);

  return (
    <div className="flex flex-col gap-8 pt-4">
      <WasteSortingGame locale={locale} />

      {history.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {history.map((h) => (
            <span
              key={h.id}
              className="flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-bold"
            >
              ⭐ {h.correctCount}/{h.totalCount}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
