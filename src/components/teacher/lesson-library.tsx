"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, Eye, Loader2, RotateCcw, Send, Users } from "lucide-react";
import { toast } from "sonner";
import {
  publishExistingLessonAction,
  setLessonArchivedAction,
} from "@/app/[locale]/app/teacher/ai-studio/actions";
import type { LessonListItem } from "@/db/repo/lessons";
import { LESSON_STATUS_LABEL } from "@/lib/domain/lesson-status";
import { AGE_BAND_PROFILES, isAgeBand } from "@/lib/domain/age-bands";
import { Link } from "@/i18n/navigation";
import type { StudioGroup } from "@/components/teacher/ai-studio";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "published", "draft", "archived"] as const;

export function LessonLibrary({
  locale,
  lessons,
  groups,
}: {
  locale: string;
  lessons: LessonListItem[];
  groups: StudioGroup[];
}) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("all");
  const visible = filter === "all" ? lessons : lessons.filter((l) => l.status === filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Барлығы" : LESSON_STATUS_LABEL[f]} (
            {f === "all" ? lessons.length : lessons.filter((l) => l.status === f).length})
          </Button>
        ))}
      </div>
      {visible.length === 0 && <p className="text-sm text-muted-foreground">Бұл санатта материал жоқ.</p>}
      {visible.map((lesson) => (
        <LessonRow key={lesson.id} locale={locale} lesson={lesson} groups={groups} />
      ))}
    </div>
  );
}

function LessonRow({ locale, lesson, groups }: { locale: string; lesson: LessonListItem; groups: StudioGroup[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"publish" | "archive" | null>(null);
  const unassignedGroups = groups.filter((g) => !lesson.groups.some((a) => a.groupId === g.id));
  const [targetGroup, setTargetGroup] = React.useState(unassignedGroups[0]?.id ?? "");
  // A "published" lesson with no group reached nobody — the legacy
  // state the old save action could silently produce.
  const orphaned = lesson.status === "published" && lesson.groups.length === 0;
  const reach = lesson.groups.reduce((sum, g) => sum + g.childCount, 0);

  async function run(kind: "publish" | "archive", fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setBusy(kind);
    try {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Қате орын алды. Қайталап көріңіз.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{lesson.topic}</span>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={lesson.status === "published" ? "default" : "outline"}>
            {LESSON_STATUS_LABEL[lesson.status]}
          </Badge>
          <span>{isAgeBand(lesson.ageBand) ? AGE_BAND_PROFILES[lesson.ageBand].label : lesson.ageBand}</span>
          <span>{new Date(lesson.createdAt).toLocaleDateString(locale)}</span>
        </div>
      </div>

      {lesson.groups.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Users className="size-3.5 text-muted-foreground" />
          {lesson.groups.map((g) => (
            <Badge key={g.groupId} variant="secondary">
              {g.groupName} · {g.childCount} бала · {new Date(g.assignedAt).toLocaleDateString(locale)}
            </Badge>
          ))}
          {lesson.status === "published" ? (
            <span className="text-muted-foreground">— барлығы {reach} бала көре алады</span>
          ) : (
            <span className="text-muted-foreground">— қазір балаларға көрінбейді</span>
          )}
        </div>
      ) : (
        orphaned && (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle className="size-3.5" />
            Жарияланған деп белгіленген, бірақ ешбір топқа байланбаған — балалар көрмейді. Төменнен топты таңдап,
            қайта жариялаңыз.
          </p>
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/app/teacher/ai-studio/${lesson.id}`}
          className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "gap-1")}
        >
          <Eye className="size-3.5" />
          Қарау
        </Link>

        {lesson.status !== "archived" && unassignedGroups.length > 0 && (
          <>
            <Select value={targetGroup} onValueChange={(v) => v && setTargetGroup(v)}>
              <SelectTrigger size="sm" className="w-52" aria-label="Жариялайтын топ">
                <SelectValue>
                  {(v: string) => {
                    const g = unassignedGroups.find((x) => x.id === v);
                    return g ? `${g.name} (${g.code})` : "Топты таңдаңыз";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {unassignedGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!!busy || !targetGroup}
              className="gap-1"
              onClick={() =>
                run("publish", () => publishExistingLessonAction(locale, { lessonId: lesson.id, groupId: targetGroup }))
              }
            >
              {busy === "publish" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Жариялау
            </Button>
          </>
        )}

        {lesson.status === "archived" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            className="gap-1"
            onClick={() => run("archive", () => setLessonArchivedAction(locale, { lessonId: lesson.id, archived: false }))}
          >
            {busy === "archive" ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            Қалпына келтіру
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={!!busy}
            className="gap-1 text-muted-foreground"
            onClick={() => run("archive", () => setLessonArchivedAction(locale, { lessonId: lesson.id, archived: true }))}
          >
            {busy === "archive" ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
            Архивтеу
          </Button>
        )}
      </div>
    </div>
  );
}
