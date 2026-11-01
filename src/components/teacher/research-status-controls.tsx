"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, EyeOff, Loader2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { setProjectStatusAction } from "@/app/[locale]/app/teacher/research/actions";
import type { ResearchStatus } from "@/lib/validation/research";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** draft → active (publish) → completed (with a conclusion) → active again. */
export function ResearchStatusControls({
  locale,
  projectId,
  status,
  conclusion,
}: {
  locale: string;
  projectId: string;
  status: ResearchStatus;
  conclusion: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<ResearchStatus | null>(null);
  const [completing, setCompleting] = React.useState(false);
  const [text, setText] = React.useState(conclusion ?? "");

  async function change(next: ResearchStatus, withConclusion?: string) {
    setPending(next);
    try {
      const res = await setProjectStatusAction(locale, projectId, { status: next, conclusion: withConclusion });
      if (res.ok) {
        toast.success(
          next === "active" ? "Зерттеу балаларға көрінеді." : next === "completed" ? "Зерттеу аяқталды." : "Жобаға қайтарылды."
        );
        setCompleting(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Қате орын алды.");
    } finally {
      setPending(null);
    }
  }

  const spinner = (s: ResearchStatus) => (pending === s ? <Loader2 className="size-3.5 animate-spin" /> : null);

  if (completing) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Қорытынды: не анықтадық?"
        />
        <div className="flex gap-2">
          <Button size="sm" disabled={!!pending} onClick={() => change("completed", text.trim() || undefined)}>
            {spinner("completed") ?? <CheckCircle2 className="size-3.5" />}
            Аяқтау
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCompleting(false)}>
            Бас тарту
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <Button size="sm" disabled={!!pending} className="gap-1" onClick={() => change("active")}>
          {spinner("active") ?? <Send className="size-3.5" />}
          Жариялау
        </Button>
      )}
      {status === "active" && (
        <>
          <Button size="sm" variant="outline" disabled={!!pending} className="gap-1" onClick={() => setCompleting(true)}>
            <CheckCircle2 className="size-3.5" />
            Аяқтау
          </Button>
          <Button size="sm" variant="ghost" disabled={!!pending} className="gap-1" onClick={() => change("draft")}>
            {spinner("draft") ?? <EyeOff className="size-3.5" />}
            Балалардан жасыру
          </Button>
        </>
      )}
      {status === "completed" && (
        <Button size="sm" variant="outline" disabled={!!pending} className="gap-1" onClick={() => change("active")}>
          {spinner("active") ?? <RotateCcw className="size-3.5" />}
          Қайта ашу
        </Button>
      )}
    </div>
  );
}
