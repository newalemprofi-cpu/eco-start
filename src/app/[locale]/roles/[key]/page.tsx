import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getOptionalSession } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";
import { MODULE_INFO } from "@/lib/marketing/module-info";
import { isPublicRoleKey, ROLE_INFO } from "@/lib/marketing/role-info";

export default async function RoleInfoPage({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  if (!isPublicRoleKey(key)) notFound();
  const info = ROLE_INFO[key];
  const session = await getOptionalSession();
  // Signed in → straight to *their own* cabinet, whatever card they opened.
  const loginHref = session ? roleHome(session.role) : "/login";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <Link href="/" className="flex w-fit items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Басты бет
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-4xl" aria-hidden>
              {info.emoji}
            </span>
            <h1 className="font-heading text-3xl font-extrabold">{info.name}</h1>
          </div>
          <Link href={loginHref} className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}>
            {session ? "Кабинетке өту" : "Жүйеге кіру"}
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <p className="text-lg text-pretty">{info.summary}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-2 pt-2">
              <h2 className="font-heading font-bold">Функциялары мен мүмкіндіктері</h2>
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
              <h2 className="font-heading font-bold">Платформаны қалай қолдану</h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                {info.howTo.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">{info.loginHint}</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 font-heading text-xl font-bold">Қолданатын модульдер</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {info.modules.map((m) => (
              <Link key={m} href={`/modules/${m}`} className="group">
                <Card className="h-full border-border/60 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <CardContent className="flex items-center gap-3 pt-2">
                    <span className="text-3xl" aria-hidden>
                      {MODULE_INFO[m].emoji}
                    </span>
                    <div>
                      <p className="font-heading font-bold">{MODULE_INFO[m].name}</p>
                      <p className="text-xs text-muted-foreground">{MODULE_INFO[m].tagline}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
