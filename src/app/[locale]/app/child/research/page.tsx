import { getTranslations, setRequestLocale } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { listProjectsForChild } from "@/db/repo/research";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ChildResearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  const projects = await listProjectsForChild(toTenantContext(session));
  const t = await getTranslations("research");

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border/60 py-8 text-center">
          <span className="text-5xl" aria-hidden>
            🔬
          </span>
          <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/app/child/research/${p.id}`}>
              <Card className="border-border/60 shadow-sm transition hover:shadow-md">
                <CardContent className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-module-research/15 text-module-research">
                      <FlaskConical className="size-4.5" />
                    </span>
                    <Badge variant="outline">{t(`status.${p.status}`)}</Badge>
                  </div>
                  <h3 className="font-heading font-bold">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.question}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
