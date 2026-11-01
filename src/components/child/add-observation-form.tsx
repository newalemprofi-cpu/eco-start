"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Minus, Plus, Send } from "lucide-react";
import { addGrowthLogAction } from "@/app/[locale]/app/child/greenhouse/actions";
import type { GrowthStage } from "@/lib/domain/plant-catalog";
import { cn } from "@/lib/utils";

/**
 * Picture-first growth log. A 3-4 year-old taps "how many leaves"
 * (1…maxLeaves leaf pictures) and the stage picture — no typing.
 * Older children additionally get a big +/− centimetre stepper
 * (`showHeight`), which writes the same height_cm as before.
 */
export function AddObservationForm({
  locale,
  entryId,
  stages,
  maxLeaves,
  showHeight,
}: {
  locale: string;
  entryId: string;
  stages: GrowthStage[];
  maxLeaves: number;
  showHeight: boolean;
}) {
  const t = useTranslations("greenhouse");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [leafCount, setLeafCount] = React.useState<number | null>(null);
  const [stage, setStage] = React.useState<string | null>(null);
  const [heightCm, setHeightCm] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const nothingChosen = leafCount == null && !stage && heightCm == null;

  async function onSubmit() {
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    if (leafCount != null) fd.set("leafCount", String(leafCount));
    if (stage) fd.set("stage", stage);
    if (heightCm != null) fd.set("heightCm", String(heightCm));
    try {
      const res = await addGrowthLogAction(locale, entryId, fd);
      if (res.ok) {
        setLeafCount(null);
        setStage(null);
        setHeightCm(null);
        setMessage("🎉 Жарайсың!");
        router.refresh();
      } else {
        setMessage("🙂 Алдымен суретті таңда");
      }
    } catch {
      setMessage("📶 Байланыс жоқ. Тағы бас!");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 font-heading text-lg font-bold">🍃 Неше жапырақ?</p>
        <div className={cn("grid gap-2", maxLeaves <= 5 ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-10")}>
          {Array.from({ length: maxLeaves }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} жапырақ`}
              aria-pressed={leafCount === n}
              onClick={() => setLeafCount(leafCount === n ? null : n)}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl border-4 p-1 transition active:scale-95",
                leafCount === n ? "border-primary bg-primary/10" : "border-border/60 bg-card"
              )}
            >
              {/* Up to 5, the leaves themselves are the picture to count;
                  beyond that (older children) one leaf + a big number. */}
              <span className="flex max-w-full flex-wrap justify-center text-lg leading-none" aria-hidden>
                {maxLeaves <= 5 ? "🍃".repeat(n) : "🍃"}
              </span>
              <span className={cn("font-extrabold", maxLeaves <= 5 ? "text-base" : "text-2xl")}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-heading text-lg font-bold">🌱 Қандай болды?</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {stages.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={stage === s.key}
              onClick={() => setStage(stage === s.key ? null : s.key)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border-4 p-3 transition active:scale-95",
                stage === s.key ? "border-primary bg-primary/10" : "border-border/60 bg-card"
              )}
            >
              <span className="text-4xl" aria-hidden>
                {s.emoji}
              </span>
              <span className="text-xs font-bold">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {showHeight && (
        <div>
          <p className="mb-2 font-heading text-lg font-bold">📏 {t("heightCm")}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Азайту"
              onClick={() => setHeightCm((h) => Math.max(0, Math.round(((h ?? 0) - 0.5) * 10) / 10))}
              className="flex size-16 items-center justify-center rounded-2xl border-2 border-border/60 bg-card active:scale-95"
            >
              <Minus className="size-8" />
            </button>
            <span className="min-w-28 text-center font-heading text-4xl font-extrabold">
              {heightCm ?? "—"}
              <span className="ml-1 text-lg text-muted-foreground">см</span>
            </span>
            <button
              type="button"
              aria-label="Көбейту"
              onClick={() => setHeightCm((h) => Math.round(((h ?? 0) + 0.5) * 10) / 10)}
              className="flex size-16 items-center justify-center rounded-2xl border-2 border-border/60 bg-card active:scale-95"
            >
              <Plus className="size-8" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={pending || nothingChosen}
        onClick={onSubmit}
        className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-xl font-bold text-primary-foreground shadow-md transition active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-7 animate-spin" /> : <Send className="size-7" />}
        {t("addObservation")}
      </button>
      {message && (
        <p role="status" className="text-center text-lg">
          {message}
        </p>
      )}
    </div>
  );
}
