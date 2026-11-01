"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { createPlantAction } from "@/app/[locale]/app/child/greenhouse/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  PLANT_CATEGORIES,
  PLANT_CATEGORY_INFO,
  plantsInCategory,
  type PlantCategory,
  type PlantDefinition,
} from "@/lib/domain/plant-catalog";
import { cn } from "@/lib/utils";

type Locale = "kk" | "ru" | "en";

// Tap-only: category picture → plant picture → watering picture. No
// typing anywhere — preschoolers can't reliably type.
const WATER_OPTIONS = [
  { value: "every_day", emoji: "💧", label: "Күн сайын" },
  { value: "every_2_days", emoji: "💧💧", label: "2 күнде" },
  { value: "every_week", emoji: "📅", label: "Аптасына" },
] as const;

export function AddPlantDialog({ locale }: { locale: Locale }) {
  const t = useTranslations("greenhouse");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<PlantCategory>("vegetables");
  const [plant, setPlant] = React.useState<PlantDefinition | null>(null);
  const [waterSchedule, setWaterSchedule] = React.useState<(typeof WATER_OPTIONS)[number]["value"]>("every_2_days");

  function reset() {
    setPlant(null);
    setError(null);
    setCategory("vegetables");
  }

  async function onSubmit() {
    if (!plant) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("nickname", plant.name);
    fd.set("plantKey", plant.key);
    fd.set("waterSchedule", waterSchedule);
    try {
      const res = await createPlantAction(locale, fd);
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError("🙂 Тағы бір рет байқап көр");
      }
    } catch {
      setError("📶 Байланыс жоқ. Тағы бас!");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button size="lg" className="min-h-14 gap-1.5 text-base" />}>
        <Plus className="size-5" />
        {t("addPlant")}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("addPlant")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Санат">
            {PLANT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                onClick={() => {
                  setCategory(c);
                  setPlant(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border-4 p-2 transition active:scale-95",
                  category === c ? "border-primary bg-primary/10" : "border-border/60 bg-card"
                )}
              >
                <span className="text-3xl" aria-hidden>
                  {PLANT_CATEGORY_INFO[c].emoji}
                </span>
                <span className="text-[11px] font-bold sm:text-xs">{PLANT_CATEGORY_INFO[c].label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {plantsInCategory(category).map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={plant?.key === p.key}
                onClick={() => setPlant(p)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border-4 p-3 transition active:scale-95",
                  plant?.key === p.key ? "border-primary bg-primary/10" : "border-border/60 bg-card"
                )}
              >
                <span className="text-4xl" aria-hidden>
                  {p.emoji}
                </span>
                <span className="text-xs font-bold">{p.name}</span>
              </button>
            ))}
          </div>

          {plant && (
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Қалай өседі</p>
              <div className="flex items-center justify-between gap-1 text-2xl" aria-label="Өсу кезеңдері">
                {plant.stages.map((s, i) => (
                  <React.Fragment key={s.key}>
                    {i > 0 && <span className="text-sm text-muted-foreground">→</span>}
                    <span title={s.label} className="flex flex-col items-center">
                      {s.emoji}
                      <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">{t("waterSchedule")}</p>
            <div className="grid grid-cols-3 gap-2">
              {WATER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-label={opt.label}
                  aria-pressed={waterSchedule === opt.value}
                  onClick={() => setWaterSchedule(opt.value)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-2xl border-4 p-3 text-2xl transition active:scale-95",
                    waterSchedule === opt.value ? "border-primary bg-primary/10" : "border-border/60 bg-card"
                  )}
                >
                  {opt.emoji}
                  <span className="text-[11px] font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-center text-lg">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" size="lg" />}>{tCommon("cancel")}</DialogClose>
          <Button size="lg" onClick={onSubmit} disabled={pending || !plant}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
