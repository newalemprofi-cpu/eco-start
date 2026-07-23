"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateLessonAction, saveLessonAction } from "@/app/[locale]/app/teacher/ai-studio/actions";
import type { LessonBundle } from "@/lib/ai/types";
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

export function AiStudio({ locale }: { locale: string }) {
  const t = useTranslations("teacher");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [topic, setTopic] = React.useState("");
  const [ageBand, setAgeBand] = React.useState("5-6");
  const [pending, setPending] = React.useState(false);
  const [saving, setSaving] = React.useState<"draft" | "publish" | null>(null);
  const [generated, setGenerated] = React.useState<{
    bundle: LessonBundle;
    provider: string;
    isMock: boolean;
  } | null>(null);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setGenerated(null);
    const fd = new FormData();
    fd.set("topic", topic);
    fd.set("ageBand", ageBand);
    const res = await generateLessonAction(locale, fd);
    setPending(false);
    if (res.ok) {
      setGenerated({ bundle: res.bundle, provider: res.provider, isMock: res.isMock });
    } else {
      toast.error(res.error);
    }
  }

  async function onSave(publish: boolean) {
    if (!generated) return;
    setSaving(publish ? "publish" : "draft");
    await saveLessonAction(locale, {
      topic,
      ageBand,
      bundle: generated.bundle,
      provider: generated.provider,
      isMock: generated.isMock,
      publish,
    });
    setSaving(null);
    toast.success(tCommon("success"));
    router.refresh();
    setGenerated(null);
    setTopic("");
  }

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
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ageBand">{t("ageBandLabel")}</Label>
              <Select value={ageBand} onValueChange={(value) => value && setAgeBand(value)}>
                <SelectTrigger id="ageBand" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5-6">5-6</SelectItem>
                  <SelectItem value="6-7">6-7</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending || !topic.trim()} size="lg" className="gap-1.5">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {pending ? t("generating") : t("generate")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {generated && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="size-3" />
              {generated.isMock ? "mock" : generated.provider}
            </Badge>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-2 pt-2">
              <h3 className="font-heading font-bold">{t("lessonPlan")}</h3>
              <p className="text-sm text-muted-foreground">{generated.bundle.objective}</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {generated.bundle.plan.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-3 pt-2">
              <h3 className="font-heading font-bold">{t("quiz")}</h3>
              {generated.bundle.quiz.map((q, i) => (
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
              <p className="mt-1 text-sm text-muted-foreground">{generated.bundle.homeworkTip}</p>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" disabled={!!saving} onClick={() => onSave(false)}>
              {saving === "draft" && <Loader2 className="size-4 animate-spin" />}
              {t("saveDraft")}
            </Button>
            <Button disabled={!!saving} onClick={() => onSave(true)}>
              {saving === "publish" && <Loader2 className="size-4 animate-spin" />}
              {t("publish")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
