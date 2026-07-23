import { getTranslations, setRequestLocale } from "next-intl/server";
import { Award, Download } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getLinkedChildren } from "@/db/repo/family";
import { getAllBadgesWithStatus, getCertificates } from "@/db/repo/passport";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ParentPassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "kk" | "ru" | "en" }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const { locale } = await params;
  const { child: childParam } = await searchParams;
  setRequestLocale(locale);
  const session = await requireRole("PARENT");
  const ctx = toTenantContext(session);
  const children = await getLinkedChildren(ctx);
  const t = await getTranslations("passport");

  if (children.length === 0) return <p className="text-muted-foreground">—</p>;
  const activeChild = children.find((c) => c.id === childParam) ?? children[0];

  const [badges, certificates] = await Promise.all([
    getAllBadgesWithStatus(ctx, activeChild.id),
    getCertificates(ctx, activeChild.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">
          {activeChild.displayName} — {t("title")}
        </h1>
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">{t("badgesTitle")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b) => {
            const earned = Boolean(b.earnedAt);
            return (
              <div
                key={b.id}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center shadow-sm ${
                  earned ? "border-module-passport/40 bg-module-passport/10" : "border-border/60 bg-muted/40 opacity-50"
                }`}
              >
                <Award className={`size-7 ${earned ? "text-module-passport" : "text-muted-foreground"}`} />
                <span className="text-xs font-bold">{b.title[locale] ?? b.title.kk}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">{t("certificatesTitle")}</h2>
        {certificates.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("noCertificates")}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {certificates.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3"
              >
                <p className="font-semibold">{c.title[locale] ?? c.title.kk}</p>
                <a
                  href={`/api/certificates/${c.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
                >
                  <Download className="size-3.5" />
                  {t("downloadCertificate")}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
