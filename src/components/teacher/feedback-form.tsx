"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { setFeedbackAction } from "@/app/[locale]/app/teacher/research/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackForm({
  locale,
  projectId,
  initialValue,
}: {
  locale: string;
  projectId: string;
  initialValue: string | null;
}) {
  const t = useTranslations("research");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        await setFeedbackAction(locale, projectId, fd);
        setPending(false);
        router.refresh();
      }}
      className="flex flex-col gap-2"
    >
      <Textarea name="feedback" defaultValue={initialValue ?? ""} rows={2} placeholder={t("teacherFeedback")} />
      <Button type="submit" size="sm" disabled={pending} className="w-fit gap-1.5">
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        {t("teacherFeedback")}
      </Button>
    </form>
  );
}
