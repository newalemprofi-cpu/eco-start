"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createParentAction } from "@/app/[locale]/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddParentDialog({ locale }: { locale: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const res = await createParentAction(locale, formData);
    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Қате орын алды");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" />
        Ата-ана қосу
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ата-ана қосу</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="displayName">Аты-жөні</Label>
            <Input id="displayName" name="displayName" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Құпия сөз</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Бас тарту</DialogClose>
            <Button type="submit" disabled={pending}>
              Сақтау
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
