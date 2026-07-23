import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import {
  getPublishedNewsBySlug,
  getPublishedNewsNeighbors,
  incrementNewsViewCount,
  type NewsCategory,
} from "@/db/repo/news";

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

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const item = await getPublishedNewsBySlug(slug);
  if (!item || !item.enabled) notFound();
  void incrementNewsViewCount(slug);

  const { prev, next } = await getPublishedNewsNeighbors(slug);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <Link href="/news" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            <ArrowLeft className="size-3.5" />
            Барлық жаңалықтарға оралу
          </Link>

          <div className="mt-6 flex items-center gap-2">
            <Badge variant="outline">{CATEGORY_LABEL[item.category]}</Badge>
            <span className="text-sm text-muted-foreground">{formatDate(item.display_date)}</span>
            {item.author && <span className="text-sm text-muted-foreground">· {item.author}</span>}
          </div>

          <h1 className="mt-3 font-heading text-3xl font-extrabold text-balance sm:text-4xl">{item.title}</h1>

          {item.main_image_url && (
            <div className="mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.main_image_url} alt="" className="size-full object-cover" />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4 text-base text-pretty whitespace-pre-line">{item.body}</div>

          {item.gallery_urls.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {item.gallery_urls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="aspect-square rounded-xl object-cover" />
              ))}
            </div>
          )}

          <div className="mt-12 flex items-center justify-between gap-4 border-t border-border/60 pt-6">
            {prev ? (
              <Link href={`/news/${prev.slug}`} className="group flex max-w-[45%] flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <ArrowLeft className="size-3.5" /> Алдыңғы жаңалық
                </span>
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/news/${next.slug}`} className="group flex max-w-[45%] flex-col items-end gap-1 text-right">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  Келесі жаңалық <ArrowRight className="size-3.5" />
                </span>
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">{next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </div>
        </article>
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
