import { ArrowRight, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { NewsCarousel, type CarouselNewsItem } from "@/components/marketing/news-carousel";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { renderIcon } from "@/lib/marketing/icon-map";
import { getOptionalSession } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";
import { getActiveBrand } from "@/lib/theme/active-theme";
import { listPublishedModules, listPublishedRoleCards, listPublishedSections } from "@/db/repo/cms";
import { listPublishedNews } from "@/db/repo/news";

type Locale = "kk" | "ru" | "en";

const HOME_NEWS_LIMIT = 6;

/** CMS text wins when an editor filled it in for this locale; otherwise
 * fall back to the message catalog so a page never silently renders
 * another language or an empty string. */
function pick(value: string | undefined | null, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function formatNewsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("kk-KZ", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const t = await getTranslations("landing");
  const tModules = await getTranslations("modules");
  const tRoles = await getTranslations("roles");
  const tCommon = await getTranslations("common");

  const [newsRows, sections, modules, roleCards, session, brand] = await Promise.all([
    listPublishedNews(),
    listPublishedSections(),
    listPublishedModules(),
    listPublishedRoleCards(),
    getOptionalSession(),
    getActiveBrand(),
  ]);

  const featuredNews: CarouselNewsItem[] = newsRows
    .filter((n) => n.enabled && n.featured_home)
    .sort((a, b) => a.display_order - b.display_order)
    .slice(0, HOME_NEWS_LIMIT)
    .map((n) => ({
      groupId: n.group_id,
      slug: n.slug,
      title: n.title,
      excerpt: n.excerpt,
      dateLabel: formatNewsDate(n.display_date),
      imageUrl: n.main_image_url,
    }))
    .filter((n) => n.title);

  const sectionByKey = new Map(sections.filter((s) => s.enabled).map((s) => [s.key, s]));
  const enabledModules = [...modules]
    .filter((m) => m.enabled)
    .sort((a, b) => a.display_order - b.display_order);
  const enabledRoleCards = [...roleCards]
    .filter((r) => r.enabled)
    .sort((a, b) => a.display_order - b.display_order);

  const introSection = sectionByKey.get("intro");
  const modulesSection = sectionByKey.get("modules");
  const ecoAiSection = sectionByKey.get("eco_ai");
  const rolesSection = sectionByKey.get("roles");
  const resultsSection = sectionByKey.get("results");
  const ctaSection = sectionByKey.get("cta");
  const footerSection = sectionByKey.get("footer");

  function roleCardHref(route: string): string {
    if (!session) return `/login?next=${encodeURIComponent(route)}`;
    return roleHome(session.role);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero — news carousel (see src/components/marketing/news-carousel.tsx) */}
        {featuredNews.length > 0 ? (
          <NewsCarousel items={featuredNews} />
        ) : (
          <section className="relative overflow-hidden border-b border-border/60">
            <div
              className="pointer-events-none absolute inset-0 -z-10 opacity-70"
              style={{
                background:
                  "radial-gradient(600px circle at 15% 20%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 60%), radial-gradient(500px circle at 85% 0%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 55%)",
              }}
            />
            <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 md:py-28">
              <div className="flex animate-in fade-in slide-in-from-bottom-4 duration-700 flex-col items-start gap-6">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" />
                  {t("heroKicker")}
                </span>
                <h1 className="max-w-3xl font-heading text-4xl font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
                  {t("heroTitle")}
                </h1>
                <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("heroSubtitle")}</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
                    {t("ctaLogin")}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link href="/login#demo" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
                    {t("ctaDemo")}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Platform introduction */}
        {introSection && (
          <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <h2 className="font-heading text-2xl font-bold text-balance sm:text-3xl">
              {pick(introSection.content[loc]?.title, "")}
            </h2>
            <p className="mt-3 text-muted-foreground text-pretty">
              {pick(introSection.content[loc]?.description, "")}
            </p>
          </section>
        )}

        {/* Modules */}
        <section id="modules" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold text-balance sm:text-4xl">
              {pick(modulesSection?.content[loc]?.title, t("modulesTitle"))}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {pick(modulesSection?.content[loc]?.subtitle, t("modulesSubtitle"))}
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {enabledModules.map((mod) => {
              const content = mod.content[loc];
              const title = pick(content?.title, tModules(`${mod.key}.name`));
              const desc = pick(content?.description, tModules(`${mod.key}.desc`));
              return (
                <Link key={mod.key} href={mod.route} className="group">
                  <Card className="h-full border-border/60 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-md group-focus-visible:-translate-y-1 group-focus-visible:shadow-md">
                    <CardContent className="flex h-full flex-col gap-3 pt-2">
                      <span
                        className="flex size-11 items-center justify-center rounded-2xl text-white"
                        style={{ backgroundColor: mod.color }}
                      >
                        {renderIcon(mod.icon, "size-5")}
                      </span>
                      <h3 className="font-heading text-base font-bold">{title}</h3>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                        {t("openModule")}
                        <ArrowRight className="size-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Central AI */}
        {ecoAiSection && (
          <section className="border-y border-border/60 bg-muted/40">
            <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
              <div>
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <Sparkles className="size-7" />
                </span>
                <h2 className="mt-5 font-heading text-3xl font-bold text-balance">
                  {pick(ecoAiSection.content[loc]?.title, t("aiTitle"))}
                </h2>
                <p className="mt-4 max-w-xl text-muted-foreground text-pretty">
                  {pick(ecoAiSection.content[loc]?.description, t("aiBody"))}
                </p>
                <div className="mt-6 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
                  <Sparkles className="size-5 shrink-0 text-warning" />
                  <span>{tCommon("devModeDesc")}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {enabledModules.slice(0, 4).map((mod) => {
                  return (
                    <div
                      key={mod.key}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-6 text-center shadow-sm"
                    >
                      <span
                        className="flex size-10 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: mod.color }}
                      >
                        {renderIcon(mod.icon, "size-5")}
                      </span>
                      <span className="text-sm font-semibold">
                        {pick(mod.content[loc]?.title, tModules(`${mod.key}.name`))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Roles */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center font-heading text-3xl font-bold text-balance">
            {pick(rolesSection?.content[loc]?.title, t("rolesTitle"))}
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {enabledRoleCards.map((card) => {
              const title = pick(card.content[loc]?.title, tRoles(card.key));
              const desc = card.content[loc]?.description;
              return (
                <Link key={card.key} href={roleCardHref(card.route)} className="group">
                  <Card className="h-full border-border/60 text-center shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-md">
                    <CardContent className="flex flex-col items-center gap-2 pt-2">
                      <span
                        className="flex size-12 items-center justify-center rounded-2xl text-white"
                        style={{ backgroundColor: card.color }}
                      >
                        {renderIcon(card.icon, "size-6")}
                      </span>
                      <span className="font-heading text-base font-bold">{title}</span>
                      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Expected results */}
        {resultsSection && (
          <section className="border-y border-border/60 bg-muted/40">
            <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
              <h2 className="font-heading text-2xl font-bold text-balance sm:text-3xl">
                {pick(resultsSection.content[loc]?.title, "")}
              </h2>
              <p className="mt-3 text-muted-foreground text-pretty">
                {pick(resultsSection.content[loc]?.description, "")}
              </p>
            </div>
          </section>
        )}

        {/* Call to action */}
        {ctaSection && (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="flex flex-col items-center gap-4 rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-md">
              <h2 className="font-heading text-2xl font-bold text-balance sm:text-3xl">
                {pick(ctaSection.content[loc]?.title, "")}
              </h2>
              {ctaSection.content[loc]?.description && (
                <p className="max-w-xl text-primary-foreground/90 text-pretty">
                  {ctaSection.content[loc]?.description}
                </p>
              )}
              {ctaSection.content[loc]?.buttonText && (
                <Link
                  href={ctaSection.button_link || "/login"}
                  className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}
                >
                  {ctaSection.content[loc]?.buttonText}
                </Link>
              )}
            </div>
          </section>
        )}
      </main>

      <footer id="for-kindergartens" className="border-t border-border/60 py-10">
        <span id="for-schools" className="block h-0 -translate-y-16" aria-hidden />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">
            {pick(footerSection?.content[loc]?.description, t("footerNote"))}
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brand.site_name}
          </p>
        </div>
      </footer>
    </div>
  );
}
