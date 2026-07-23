"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { analyzeImageAction, type AnalyzeResult } from "@/app/[locale]/app/child/ecolab/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function EcoLabUploader({ locale }: { locale: string }) {
  const t = useTranslations("ecolab");
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeResult | null>(null);

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setPending(true);
    const fd = new FormData();
    fd.set("image", file);
    try {
      const res = await analyzeImageAction(locale, fd);
      setResult(res);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-48 w-48 rounded-2xl border border-border object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground">
            <Camera className="size-10" />
            <span className="text-sm">{t("uploadPrompt")}</span>
          </div>
        )}

        <Button size="lg" disabled={pending} onClick={() => fileInputRef.current?.click()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {pending ? t("analyzing") : t("uploadButton")}
        </Button>

        {result && result.ok && (
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-muted/40 p-4 text-left">
            <div className="flex items-center justify-between">
              <span className="font-heading text-lg font-bold">{result.label}</span>
              <Badge variant="secondary">{t(`kindLabel.${result.kind}` as never)}</Badge>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("confidenceLabel")}</span>
                <span>{Math.round(result.confidence * 100)}%</span>
              </div>
              <Progress value={result.confidence * 100} className="mt-1 h-2" />
            </div>
            <p className="mt-3 text-sm">{result.funFact}</p>
            {result.isPotentiallyToxic && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{t("toxicWarning")}</span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="size-3" />
                {t(result.isMock ? "mockBadge" : "providerBadge", { provider: result.provider })}
              </span>
              <span>+{result.xpEarned} XP</span>
            </div>
          </div>
        )}

        {result && !result.ok && (
          <p className="text-sm text-destructive">
            {result.error === "rate_limited"
              ? "⏳"
              : result.error === "invalid_file"
                ? "⚠️"
                : "⚠️"}{" "}
            {result.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
