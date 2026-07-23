"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addGrowthLogAction } from "@/app/[locale]/app/child/greenhouse/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AddObservationForm({ locale, entryId }: { locale: string; entryId: string }) {
  const t = useTranslations("greenhouse");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const res = await addGrowthLogAction(locale, entryId, formData);
    setPending(false);
    if (res.ok) {
      formRef.current?.reset();
      router.refresh();
    } else {
      toast.error(tCommon("error"));
    }
  }

  return (
    <form ref={formRef} action={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="heightCm">{t("heightCm")}</Label>
        <Input id="heightCm" name="heightCm" type="number" step="0.1" min={0} className="w-32" />
      </div>
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="note">{t("note")}</Label>
        <Textarea id="note" name="note" rows={1} className="min-h-9" />
      </div>
      <Button type="submit" disabled={pending} className="gap-1.5">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {t("addObservation")}
      </Button>
    </form>
  );
}
