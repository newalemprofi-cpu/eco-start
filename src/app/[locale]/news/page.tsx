import { ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPublishedNews, type NewsCategory } from "@/db/repo/news";

// Without this, Next treats this route as statically prerenderable
// (fixed path, no dynamic API calls) and executes listPublishedNews()
// against the database during `next build` — which fails in any Docker
// build environment where the DB isn't reachable yet or migrations
// haven't run (see PostgresError 42P01 "relation news_items does not
// exist"). Forcing dynamic rendering also matches how the rest of the
// news feature already behaves: the homepage carousel and the article
// detail page ([slug]/page.tsx) are both already request-time rendered
// (the former reads the session via cookies, the latter has no
// generateStaticParams for its dynamic segment), so a statically
// pre-baked list page would have been the one inconsistent piece even
// without the build failure — published/unpublished changes should
// show up on next visit, not only after a redeploy.
export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<NewsCategory, string> = {
  events: "Іс-шаралар",
  eco_projects: "Эко жобалар",
  child_achievements: "Балалардың жетістіктері",
  teacher_news: "Тәрбиешілер жаңалығы",
  for_parents: "Ата-аналарға",
  announcements: "Хабарландырулар",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("kk-KZ", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function NewsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const news = (await listPublishedNews())
    .filter((n) => n.enabled)
    .sort((a, b) => new Date(b.display_date).getTime() - new Date(a.display_date).getTime());

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h1 className="font-heading text-3xl font-extrabold text-balance sm:text-4xl">Жаңалықтар</h1>
          <p className="mt-2 text-muted-foreground">
            №37 «Жұлдыз-ай» бөбекжайының соңғы жаңалықтары мен оқиғалары.
          </p>

          {news.length === 0 ? (
            <p className="mt-12 text-center text-muted-foreground">Әзірге жаңалық жоқ.</p>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {news.map((item) => (
                <Link key={item.group_id} href={`/news/${item.slug}`} className="group">
                  <Card className="h-full overflow-hidden border-border/60 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-md">
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      {item.main_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.main_image_url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-4xl">📰</div>
                      )}
                    </div>
                    <CardContent className="flex flex-col gap-2 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{CATEGORY_LABEL[item.category]}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(item.display_date)}</span>
                      </div>
                      <h2 className="font-heading text-base font-bold text-balance">{item.title}</h2>
                      <p className="line-clamp-3 text-sm text-muted-foreground">{item.excerpt}</p>
                      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary">
                        Толығырақ
                        <ArrowRight className="size-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          <Link href="/" className="hover:text-foreground">
            ← Басты бетке оралу
          </Link>
        </div>
      </footer>
    </div>
  );
}
