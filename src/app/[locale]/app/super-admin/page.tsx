import { setRequestLocale } from "next-intl/server";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getAiUsageByProvider, listSchools } from "@/db/repo/super-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SuperAdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("SUPER_ADMIN");
  const ctx = toTenantContext(session);
  const [schools, usage] = await Promise.all([listSchools(ctx), getAiUsageByProvider(ctx)]);

  const totalChildren = schools.reduce((sum, s) => sum + s.childCount, 0);
  const totalTeachers = schools.reduce((sum, s) => sum + s.teacherCount, 0);
  const totalNeedsReview = schools.reduce((sum, s) => sum + s.needsReviewCount, 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl font-extrabold">Платформа көрінісі</h1>

      {totalNeedsReview > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span className="font-semibold">Тобы анықталмаған {totalNeedsReview} бала</span> — Excel деректерінде
          екі топта қатар кездескен балалар. Дұрыс топты{" "}
          <a href="../admin/children" className="underline underline-offset-2">
            Балалар бөлімінде
          </a>{" "}
          таңдап растаңыз.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <p className="font-heading text-2xl font-extrabold text-primary">{schools.length}</p>
            <p className="text-xs text-muted-foreground">Бөбекжайлар</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <p className="font-heading text-2xl font-extrabold text-primary">{totalTeachers}</p>
            <p className="text-xs text-muted-foreground">Тәрбиешілер</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <p className="font-heading text-2xl font-extrabold text-primary">{totalChildren}</p>
            <p className="text-xs text-muted-foreground">Балалар</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <p className="font-heading text-2xl font-extrabold text-primary">
              {usage.reduce((s, u) => s + u.calls, 0)}
            </p>
            <p className="text-xs text-muted-foreground">AI шақырулары</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">Бөбекжайлар</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {schools.map((s) => (
            <Card key={s.id} className="border-border/60 shadow-sm">
              <CardContent className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.region}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{s.plan}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {s.teacherCount}T / {s.childCount}C
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold">AI провайдерлер бойынша қолданылуы</h2>
        <div className="mt-3 flex flex-col gap-1.5">
          {usage.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
          {usage.map((u) => (
            <div
              key={u.provider}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-2 text-sm"
            >
              <span className="font-medium">{u.provider}</span>
              <span className="text-muted-foreground">
                {u.calls} шақыру ({u.mockCalls} демо)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
