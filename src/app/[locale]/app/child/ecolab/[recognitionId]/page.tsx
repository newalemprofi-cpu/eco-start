import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ShieldAlert, Sparkles } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { getRecognitionForChild } from "@/db/repo/ecolab";
import { Link } from "@/i18n/navigation";
import { ChildPhoto } from "@/components/child-photo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KIND_EMOJI = { PLANT: "🌿", ANIMAL: "🐾", LEAF: "🍂", OBJECT: "🪨" } as const;

export default async function RecognitionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; recognitionId: string }>;
}) {
  const { locale, recognitionId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("CHILD");
  if (!UUID_RE.test(recognitionId)) notFound();
  // Filtered by child_id = the signed-in child: another child's id 404s.
  const detail = await getRecognitionForChild(toTenantContext(session), recognitionId);
  if (!detail) notFound();
  const { entry, history, timesStudied } = detail;
  const t = await getTranslations("ecolab");
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-5 pt-4">
      <Link
        href="/app/child/ecolab"
        aria-label="Артқа"
        className="flex size-14 items-center justify-center rounded-2xl border-2 border-border/60 bg-card"
      >
        <ArrowLeft className="size-7" />
      </Link>

      <Card className="overflow-hidden border-border/60 py-0 shadow-sm">
        <ChildPhoto src={entry.imageUrl} alt={entry.label ?? ""} className="max-h-80 min-h-48 w-full bg-muted object-cover" />
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-heading text-3xl font-extrabold">
              {KIND_EMOJI[entry.kind]} {entry.label ?? "?"}
            </h1>
            <Badge variant="secondary">{t(`kindLabel.${entry.kind}` as never)}</Badge>
          </div>

          <p className="text-sm text-muted-foreground">📅 {fmt(entry.createdAt)}</p>

          <div>
            <p className="mb-1 font-heading text-sm font-bold">🤖 AI не деді</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("confidenceLabel")}</span>
              <span>{Math.round(entry.confidence * 100)}%</span>
            </div>
            <Progress value={entry.confidence * 100} className="mt-1 h-2" />
            {entry.confidence < 0.5 && <p className="mt-1 text-sm">🤔 {t("lowConfidence")} — {t("askTeacher")}</p>}
          </div>

          {entry.funFact && (
            <div className="rounded-2xl bg-module-ecolab/10 p-4 text-lg">
              <p className="mb-1 font-heading text-sm font-bold">💡 Қызық дерек</p>
              {entry.funFact}
            </div>
          )}

          {entry.isPotentiallyToxic && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <span>{t("toxicWarning")}</span>
            </div>
          )}

          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="size-3" />
            {t(entry.isMock ? "mockBadge" : "providerBadge", { provider: entry.provider })}
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-heading text-lg font-bold">
          🔁 Бұрынғы зерттеулер {timesStudied > 1 && <span className="text-muted-foreground">({timesStudied} рет)</span>}
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Бұл — алғашқы зерттеуің! 🌟</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {history.map((h) => (
              <Link key={h.id} href={`/app/child/ecolab/${h.id}`} className="rounded-xl transition active:scale-95">
                <Card className="h-full overflow-hidden border-border/60 py-0 shadow-sm">
                  <ChildPhoto src={h.imageUrl} className="h-28 w-full bg-muted object-cover" />
                  <CardContent className="px-3 py-2 text-xs text-muted-foreground">{fmt(h.createdAt)}</CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
