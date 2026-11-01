"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  generateLessonAction,
  saveLessonAction,
  type GeneratedLesson,
} from "@/app/[locale]/app/teacher/ai-studio/actions";
import type { SignedPayload } from "@/lib/ai/signed-payload";
import { AGE_BAND_PROFILES, AGE_BANDS, AGE_CATEGORY_TO_BAND, type AgeBand } from "@/lib/domain/age-bands";
import type { GroupAgeCategory } from "@/lib/group-age-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StudioGroup = { id: string; name: string; code: string; ageCategory: GroupAgeCategory; childCount: number };

export function AiStudio({ locale, groups }: { locale: string; groups: StudioGroup[] }) {
  const t = useTranslations("teacher");
  const router = useRouter();
  const [topic, setTopic] = React.useState("");
  // Default to the band matching the teacher's first group, so a 3-4
  // group teacher doesn't have to change it every time.
  const [ageBand, setAgeBand] = React.useState<AgeBand>(
    groups[0] ? AGE_CATEGORY_TO_BAND[groups[0].ageCategory] : "5-6"
  );
  const [groupId, setGroupId] = React.useState<string>(groups[0]?.id ?? "");
  const [pending, setPending] = React.useState(false);
  const [saving, setSaving] = React.useState<"draft" | "publish" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [generated, setGenerated] = React.useState<SignedPayload<GeneratedLesson> | null>(null);

  const selectedGroup = groups.find((g) => g.id === groupId) ?? null;
  const bandMismatch =
    generated && selectedGroup && AGE_CATEGORY_TO_BAND[selectedGroup.ageCategory] !== generated.data.ageBand;

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setGenerated(null);
    setError(null);
    const fd = new FormData();
    fd.set("topic", topic);
    fd.set("ageBand", ageBand);
    try {
      const res = await generateLessonAction(locale, fd);
      if (res.ok) setGenerated(res.lesson);
      else setError(res.error);
    } catch {
      setError("Байланыс қатесі. Қайталап көріңіз.");
    } finally {
      setPending(false);
    }
  }

  async function onSave(publish: boolean) {
    if (!generated) return;
    if (publish && !groupId) {
      setError("Жариялау үшін топты таңдаңыз.");
      return;
    }
    setSaving(publish ? "publish" : "draft");
    setError(null);
    try {
      const res = await saveLessonAction(locale, { lesson: generated, groupId: publish ? groupId : null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.message);
      setGenerated(null);
      setTopic("");
      router.refresh();
    } catch {
      setError("Сақтау кезінде қате шықты. Қайталап көріңіз.");
    } finally {
      setSaving(null);
    }
  }

  const bundle = generated?.data.bundle;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-2">
          <form onSubmit={onGenerate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="topic">{t("topicLabel")}</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t("topicPlaceholder")}
                maxLength={120}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ageBand">{t("ageBandLabel")}</Label>
              <Select value={ageBand} onValueChange={(value) => value && setAgeBand(value as AgeBand)}>
                <SelectTrigger id="ageBand" className="w-32">
                  <SelectValue>{(v: AgeBand) => AGE_BAND_PROFILES[v]?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AGE_BANDS.map((band) => (
                    <SelectItem key={band} value={band}>
                      {AGE_BAND_PROFILES[band].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending || topic.trim().length < 2} size="lg" className="gap-1.5">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {pending ? t("generating") : t("generate")}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            {AGE_BAND_PROFILES[ageBand].label}: ~{AGE_BAND_PROFILES[ageBand].durationMinutes} мин, ең көбі{" "}
            {AGE_BAND_PROFILES[ageBand].maxPlanSteps} қадам, {AGE_BAND_PROFILES[ageBand].maxQuizQuestions} сұрақ.
          </p>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {generated && bundle && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="size-3" />
              {generated.data.isMock ? "mock" : generated.data.provider}
            </Badge>
            <Badge variant="secondary">{AGE_BAND_PROFILES[generated.data.ageBand].label}</Badge>
            {bundle.durationMinutes && (
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />~{bundle.durationMinutes} мин
              </Badge>
            )}
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-2 pt-2">
              <h3 className="font-heading font-bold">{t("lessonPlan")}</h3>
              <p className="text-sm text-muted-foreground">{bundle.objective}</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {bundle.plan.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-3 pt-2">
              <h3 className="font-heading font-bold">{t("quiz")}</h3>
              {bundle.quiz.map((q, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold">{q.question}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {q.options.map((opt, j) => (
                      <li
                        key={j}
                        className={`rounded-lg border px-2.5 py-1 text-xs ${
                          j === q.correctIndex
                            ? "border-success/40 bg-success/10 font-semibold"
                            : "border-border/60"
                        }`}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="pt-2">
              <h3 className="font-heading font-bold">{t("homeworkTip")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{bundle.homeworkTip}</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor="publishGroup">Қай топқа жариялау</Label>
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Сізге әлі топ бекітілмеген — материалды жоба ретінде сақтай аласыз. Топты меңгеруші немесе
                    платформа әкімшісі бекітеді.
                  </p>
                ) : (
                  <Select value={groupId} onValueChange={(value) => value && setGroupId(value)}>
                    <SelectTrigger id="publishGroup" className="w-full sm:w-72">
                      <SelectValue>
                        {(v: string) => {
                          const g = groups.find((x) => x.id === v);
                          return g ? `${g.name} (${g.code}) · ${g.childCount} бала` : "Топты таңдаңыз";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} ({g.code}) · {g.childCount} бала
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {bandMismatch && (
                  <p className="text-xs text-warning">
                    Назар аударыңыз: материал {AGE_BAND_PROFILES[generated.data.ageBand].label} балаларға жасалған,
                    ал таңдалған топ — {AGE_BAND_PROFILES[AGE_CATEGORY_TO_BAND[selectedGroup.ageCategory]].label}.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={!!saving} onClick={() => onSave(false)}>
                  {saving === "draft" && <Loader2 className="size-4 animate-spin" />}
                  {t("saveDraft")}
                </Button>
                <Button disabled={!!saving || groups.length === 0} onClick={() => onSave(true)}>
                  {saving === "publish" && <Loader2 className="size-4 animate-spin" />}
                  {t("publish")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
