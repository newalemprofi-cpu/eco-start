"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadMediaAction } from "@/app/[locale]/app/child/studio/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function MediaUploader({ locale }: { locale: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const res = await uploadMediaAction(locale, formData);
    setPending(false);
    if (res.ok) {
      formRef.current?.reset();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="pt-2">
        <form ref={formRef} action={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input name="title" placeholder="Атауы" required className="flex-1" />
          <Input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="sm:w-56" />
          <Button type="submit" disabled={pending} className="shrink-0 gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            Upload
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
