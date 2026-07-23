import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getGameByKey, getGameHistory } from "@/db/repo/games";
import { GamePlayer } from "@/components/child/game-player";
import { GameIllustration } from "@/components/child/game-illustration";
import type { AppLocale } from "@/i18n/routing";

export default async function GenericGamePage({
  params,
}: {
  params: Promise<{ locale: AppLocale; gameKey: string }>;
}) {
  const { locale, gameKey } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);

  const game = await getGameByKey(ctx, gameKey);
  if (!game) notFound();

  const history = await getGameHistory(ctx, gameKey, 5);

  return (
    <div className="flex flex-col gap-8 pt-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <GameIllustration color={game.color} icon={game.icon} size="sm" />
        <h1 className="font-heading text-lg font-extrabold">{game.title[locale]}</h1>
      </div>

      <GamePlayer template={game.template} gameKey={game.key} locale={locale} config={game.config} />

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
