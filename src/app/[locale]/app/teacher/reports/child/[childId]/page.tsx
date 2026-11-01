import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireRole, toTenantContext } from "@/lib/auth/dal";
import { ACTIVITY_WINDOW_DAYS, getChildDetail, getTeacherChildGroup } from "@/db/repo/analytics";
import { Link } from "@/i18n/navigation";
import { ActivityBars } from "@/components/teacher/activity-bars";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChildPhoto } from "@/components/child-photo";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TeacherChildReportPage({
  params,
}: {
  params: Promise<{ locale: string; childId: string }>;
}) {
  const { locale, childId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("TEACHER");
  const ctx = toTenantContext(session);
  if (!UUID_RE.test(childId)) notFound();

  // A child outside the teacher's own groups is a 404, not a 403 — no
  // hint that the id exists.
  const groupId = await getTeacherChildGroup(ctx, childId);
  if (!groupId) notFound();
  const detail = await getChildDetail(ctx, groupId, childId);
  if (!detail) notFound();
  const { child } = detail;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const counters = [
    { label: "XP", value: `${child.xp} · ${child.level}-деңгей` },
    { label: "Ойын", value: `${child.gamesPlayed} (${child.distinctGames} түрі)` },
    { label: "Зерттеу бақылауы", value: child.researchObservations },
    { label: "Эко Зертхана", value: child.recognitions },
    { label: "Өсімдік бақылауы", value: child.growthLogs },
    { label: "Белгілер", value: child.achievements },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/app/teacher/reports?group=${groupId}&view=active`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Белсенді балалар
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
          {child.avatarUrl ?? "🦉"}
        </span>
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{child.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            Соңғы белсенділік: {child.lastActivityAt ? fmt(child.lastActivityAt) : "әлі жоқ"}{" "}
            <Badge variant={child.isActive ? "default" : "outline"}>{child.isActive ? "белсенді" : "белсенді емес"}</Badge>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counters.map((c) => (
          <Card key={c.label} className="border-border/60 shadow-sm">
            <CardContent className="pt-2">
              <p className="font-heading text-xl font-extrabold text-module-analytics">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <h2 className="mb-2 font-heading text-sm font-bold text-muted-foreground">
            Белсенділік динамикасы — соңғы {ACTIVITY_WINDOW_DAYS} күн
          </h2>
          <ActivityBars tall values={child.daily} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Орындаған ойындары" empty="Әлі ойын жоқ.">
          {detail.games.map((g, i) => (
            <Row key={i} left={g.title[locale] ?? g.title.kk} right={`${g.score} ұпай · +${g.xpEarned} XP · ${fmt(g.endedAt)}`} />
          ))}
        </Section>
        <Section title="Зерттеу жұмыстары" empty="Әлі бақылау жоқ.">
          {detail.research.map((r, i) => (
            <Row
              key={i}
              left={r.projectTitle}
              right={`${r.measurement ?? ""} ${r.note ?? ""} · ${fmt(r.loggedAt)}`.trim()}
            />
          ))}
        </Section>
        <Section title="Жетістіктері" empty="Әлі белгі жоқ.">
          {detail.achievements.map((a, i) => (
            <Row key={i} left={a.title[locale] ?? a.title.kk} right={fmt(a.earnedAt)} />
          ))}
        </Section>
        <Section title="Эко Зертхана" empty="Әлі зерттелген объект жоқ.">
          {detail.recognitions.map((r, i) => (
            <Row key={i} left={r.label ?? "—"} right={fmt(r.createdAt)} />
          ))}
        </Section>
      </div>

      {detail.recognitions.some((r) => r.imageUrl) && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-2">
            <h2 className="mb-3 font-heading text-sm font-bold text-muted-foreground">Эко Зертхана суреттері</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {detail.recognitions
                .filter((r) => r.imageUrl)
                .map((r, i) => (
                  <figure key={i} className="flex flex-col gap-1">
                    <ChildPhoto src={r.imageUrl} alt={r.label ?? ""} className="aspect-square w-full rounded-lg bg-muted object-cover" />
                    <figcaption className="truncate text-[11px] text-muted-foreground">{r.label ?? "—"}</figcaption>
                  </figure>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex flex-col gap-1.5 pt-2">
        <h2 className="font-heading font-bold">{title}</h2>
        {children.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : children}
      </CardContent>
    </Card>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-1.5 text-sm">
      <span className="truncate font-medium">{left}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{right}</span>
    </div>
  );
}
