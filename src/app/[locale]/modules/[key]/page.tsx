import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getOptionalSession } from "@/lib/auth/dal";
import { getPublicPlatformStats } from "@/db/repo/public-stats";
import { isModuleKey, MODULE_INFO } from "@/lib/marketing/module-info";
import { formatStat } from "@/lib/marketing/public-stats";

export default async function ModuleInfoPage({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  if (!isModuleKey(key)) notFound();
  const info = MODULE_INFO[key];

  const [session, stats] = await Promise.all([getOptionalSession(), getPublicPlatformStats()]);
  const loginHref = session ? info.appRoute : `/login?next=${encodeURIComponent(info.appRoute)}`;
  const usage = stats?.modules[key];

  const platform = stats
    ? [
        { label: "Қатысушы балабақша", value: stats.kindergartens },
        { label: "Қатысушы бала", value: stats.children },
        { label: "Тәрбиеші", value: stats.teachers },
        { label: "Ата-ана", value: stats.parents },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <Link href="/#modules" className="flex w-fit items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Барлық модульдер
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-4xl" aria-hidden>
              {info.emoji}
            </span>
            <div>
              <h1 className="font-heading text-3xl font-extrabold">{info.name}</h1>
              <p className="text-muted-foreground">{info.tagline}</p>
            </div>
          </div>
          <Link href={loginHref} className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}>
            {session ? "Модульді ашу" : "Кіру"}
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <p className="text-lg text-pretty">{info.description}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-2 pt-2">
              <h2 className="font-heading font-bold">Мүмкіндіктері</h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {info.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-2 pt-2">
              <h2 className="font-heading font-bold">Қолдану мақсаты</h2>
              <p className="text-sm">{info.purpose}</p>
              <h2 className="mt-2 font-heading font-bold">Кім қолданады</h2>
              <p className="text-sm">{info.usedBy.join(", ")}</p>
            </CardContent>
          </Card>
        </div>

        <section aria-labelledby="stats-title" className="flex flex-col gap-3">
          <h2 id="stats-title" className="font-heading text-xl font-bold">
            Статистика
          </h2>
          {!stats || !usage ? (
            <p className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Статистика уақытша қолжетімсіз.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard value={formatStat(usage.actions)} label={`Барлығы: ${info.usage.actions}`} />
                <StatCard value={formatStat(usage.users)} label={info.usage.users} />
                <StatCard value={formatStat(usage.actions30d)} label="Соңғы 30 күнде" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {platform.map((p) => (
                  <StatCard key={p.label} value={formatStat(p.value)} label={p.label} muted />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Тек жалпы сандар көрсетіледі; демо тіркелгілер есептелмейді. Балалардың аты-жөні, суреті немесе жеке
                белсенділігі жарияланбайды.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ value, label, muted }: { value: string; label: string; muted?: boolean }) {
  return (
    <Card className={cn("border-border/60 shadow-sm", muted && "bg-muted/30")}>
      <CardContent className="pt-2">
        <p className="font-heading text-2xl font-extrabold text-primary">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
