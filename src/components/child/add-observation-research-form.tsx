"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Minus, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { addObservationAction } from "@/app/[locale]/app/child/research/actions";
import { cn } from "@/lib/utils";

// Tap-only observation notes — preschoolers pick a picture instead of
// typing. The stored note is the short Kazakh phrase, so the teacher's
// results table stays readable.
const QUICK_NOTES = [
  { emoji: "🌱", label: "Өсті" },
  { emoji: "😐", label: "Өзгерген жоқ" },
  { emoji: "🥀", label: "Солды" },
  { emoji: "💧", label: "Суардым" },
  { emoji: "☀️", label: "Күн астында" },
  { emoji: "🌥️", label: "Көлеңкеде" },
] as const;

const ERROR_TEXT: Record<string, string> = {
  empty: "🙂 Алдымен санды немесе суретті таңда",
  forbidden: "🔒 Бұл зерттеу жабық",
  validation: "🙂 Тағы бір рет байқап көр",
};

export function AddObservationResearchForm({
  locale,
  projectId,
  unit,
  disabled,
}: {
  locale: string;
  projectId: string;
  unit: string;
  disabled?: boolean;
}) {
  const t = useTranslations("research");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [measurement, setMeasurement] = React.useState<number | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  function step(delta: number) {
    setMeasurement((m) => Math.max(0, Math.round(((m ?? 0) + delta) * 10) / 10));
  }

  async function onSubmit() {
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    if (measurement != null) fd.set("measurement", String(measurement));
    if (note) fd.set("note", note);
    try {
      const res = await addObservationAction(locale, projectId, fd);
      if (res.ok) {
        setMeasurement(null);
        setNote(null);
        toast.success(`🎉 +${res.xpEarned} XP`);
        router.refresh();
      } else {
        setMessage(ERROR_TEXT[res.error] ?? ERROR_TEXT.validation);
      }
    } catch {
      setMessage("📶 Байланыс жоқ. Тағы бас!");
    } finally {
      setPending(false);
    }
  }

  if (disabled) {
    return <p className="text-center text-lg">🏁 Зерттеу аяқталды</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading text-lg font-bold">{t("addObservation")}</p>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Азайту"
          onClick={() => step(-1)}
          className="flex size-16 items-center justify-center rounded-2xl border-2 border-border/60 bg-card active:scale-95"
        >
          <Minus className="size-8" />
        </button>
        <div className="min-w-28 text-center">
          <span className="font-heading text-4xl font-extrabold">{measurement ?? "—"}</span>
          <span className="ml-1 text-lg text-muted-foreground">{unit}</span>
        </div>
        <button
          type="button"
          aria-label="Көбейту"
          onClick={() => step(1)}
          className="flex size-16 items-center justify-center rounded-2xl border-2 border-border/60 bg-card active:scale-95"
        >
          <Plus className="size-8" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {QUICK_NOTES.map((q) => (
          <button
            key={q.label}
            type="button"
            aria-pressed={note === q.label}
            onClick={() => setNote(note === q.label ? null : q.label)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border-4 p-3 transition active:scale-95",
              note === q.label ? "border-primary bg-primary/10" : "border-border/60 bg-card"
            )}
          >
            <span className="text-4xl" aria-hidden>
              {q.emoji}
            </span>
            <span className="text-xs font-semibold">{q.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={pending || (measurement == null && !note)}
        onClick={onSubmit}
        className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-xl font-bold text-primary-foreground shadow-md transition active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-7 animate-spin" /> : <Send className="size-7" />}
        {t("addObservation")}
      </button>

      {message && (
        <p role="alert" className="text-center text-lg">
          {message}
        </p>
      )}
    </div>
  );
}
