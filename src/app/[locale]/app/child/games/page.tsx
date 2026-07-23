import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getAllGameProgress, listGames } from "@/db/repo/games";
import { hasAssignedGroup } from "@/db/repo/groups";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { GameIllustration } from "@/components/child/game-illustration";
import { StarRating } from "@/components/child/star-rating";
import { starsForRatio } from "@/lib/domain/stars";
import type { AppLocale } from "@/i18n/routing";

export default async function GamesHubPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const ctx = toTenantContext(session);

  const [games, progress, hasGroup] = await Promise.all([listGames(ctx), getAllGameProgress(ctx), hasAssignedGroup(ctx)]);

  return (
    <div className="flex flex-col gap-6 pt-4">
      {!hasGroup && (
        <p className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          Топ тағайындалмаған — барлық ойындар көрсетілуде.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {games.map((game) => {
          const href = game.key === "waste_sorting" ? "/app/child/games/waste-sorting" : `/app/child/games/${game.key}`;
          const p = progress[game.id];
          const stars = p ? starsForRatio(p.bestCorrectCount, p.bestTotalCount) : null;

          return (
            <Link key={game.id} href={href} className="group">
              <Card className="h-full border-border/60 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-active:scale-95">
                <CardContent className="flex h-full flex-col items-center gap-2 pt-3 pb-4 text-center">
                  <GameIllustration color={game.color} icon={game.icon} size="md" />
                  <h3 className="font-heading text-sm font-extrabold sm:text-base">{game.title[locale]}</h3>
                  <div className="mt-auto flex h-5 items-center">
                    {stars ? (
                      <StarRating earned={stars} size="sm" />
                    ) : (
                      <span className="text-lg" aria-hidden>
                        ✨
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
