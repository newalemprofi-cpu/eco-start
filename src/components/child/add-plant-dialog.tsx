"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";

type Locale = "kk" | "ru" | "en";

// Tap-only nickname picker — a text input would require typing, which
// preschoolers can't reliably do (see the child-experience redesign).
const NICKNAME_PRESETS: { emoji: string; label: Record<Locale, string> }[] = [
  { emoji: "🌻", label: { kk: "Күнбағысым", ru: "Подсолнушек", en: "Sunny" } },
  { emoji: "🌷", label: { kk: "Қызғалдағым", ru: "Тюльпанчик", en: "Tulip" } },
  { emoji: "🌵", label: { kk: "Кактусым", ru: "Кактусик", en: "Cactus" } },
  { emoji: "🌿", label: { kk: "Жапырақшам", ru: "Листик", en: "Leafy" } },
  { emoji: "🌸", label: { kk: "Гүлшешегім", ru: "Цветочек", en: "Blossom" } },
  { emoji: "🍀", label: { kk: "Бедешкем", ru: "Клевер", en: "Clover" } },
];

const WATER_OPTIONS = [
  { value: "every_day", emoji: "💧" },
  { value: "every_2_days", emoji: "💧💧" },
  { value: "every_week", emoji: "📅" },
] as const;

export function AddPlantDialog({ locale }: { locale: Locale }) {
  const t = useTranslations("greenhouse");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [nicknameIndex, setNicknameIndex] = React.useState(0);
  const [waterSchedule, setWaterSchedule] = React.useState<(typeof WATER_OPTIONS)[number]["value"]>("every_2_days");

  async function onSubmit() {
    setPending(true);
    const fd = new FormData();
    fd.set("nickname", NICKNAME_PRESETS[nicknameIndex].label[locale]);
    fd.set("waterSchedule", waterSchedule);
    const res = await createPlantAction(locale, fd);
    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      toast.error(tCommon("error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="gap-1.5" />}>
        <Plus className="size-4" />
        {t("addPlant")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addPlant")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">{t("nickname")}</p>
            <div className="grid grid-cols-3 gap-2">
              {NICKNAME_PRESETS.map((preset, i) => (
                <button
                  key={preset.emoji}
                  type="button"
                  onClick={() => setNicknameIndex(i)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-3xl transition active:scale-95",
                    i === nicknameIndex ? "border-primary bg-primary/10" : "border-border/60 bg-card"
                  )}
                >
                  {preset.emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">{t("waterSchedule")}</p>
            <div className="grid grid-cols-3 gap-2">
              {WATER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWaterSchedule(opt.value)}
                  className={cn(
                    "flex items-center justify-center rounded-2xl border-2 p-3 text-2xl transition active:scale-95",
                    waterSchedule === opt.value ? "border-primary bg-primary/10" : "border-border/60 bg-card"
                  )}
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{tCommon("cancel")}</DialogClose>
          <Button onClick={onSubmit} disabled={pending}>
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
