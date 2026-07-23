"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createProjectAction } from "@/app/[locale]/app/teacher/research/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateProjectDialog({ locale }: { locale: string }) {
  const t = useTranslations("research");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const res = await createProjectAction(locale, formData);
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
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" />
        {t("newProject")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newProject")}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Тақырып</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="question">{t("question")}</Label>
            <Textarea id="question" name="question" rows={2} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hypothesis">{t("hypothesis")}</Label>
            <Textarea id="hypothesis" name="hypothesis" rows={2} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="measurementUnit">Unit</Label>
            <Input id="measurementUnit" name="measurementUnit" defaultValue="cm" className="w-24" />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {tCommon("cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
