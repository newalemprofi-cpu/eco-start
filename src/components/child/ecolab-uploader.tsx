"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Check, ImageIcon, Loader2, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { analyzeImageAction, type AnalyzeResult } from "@/app/[locale]/app/child/ecolab/actions";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage/types";

// Short, picture-led messages a pre-reader's adult can read aloud —
// never a raw error code like "ai_unavailable".
const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: "⏳ Сәл демалайық. Кейінірек тағы көр!",
  no_file: "📷 Алдымен фото таңда",
  invalid_file: "🖼️ Бұл фото ашылмады. Басқа фото таңда",
  too_big: "🐘 Фото тым үлкен. Басқа фото таңда",
  ai_unavailable: "😴 Көмекші қазір демалып жатыр. Кейінірек көр!",
  network: "📶 Байланыс жоқ. Тағы бас!",
};

function ChoiceButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Camera;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-28 flex-1 flex-col items-center justify-center gap-2 rounded-3xl border-4 border-module-ecolab/40 bg-module-ecolab/10 p-4 text-lg font-bold transition active:scale-95 disabled:opacity-50"
    >
      <Icon className="size-12 text-module-ecolab" />
      {label}
    </button>
  );
}

export function EcoLabUploader({ locale }: { locale: string }) {
  const t = useTranslations("ecolab");
  const router = useRouter();
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(selected: File | undefined) {
    setResult(null);
    setError(null);
    if (!selected) return;
    // Same limits as the server (validateImageUpload) — checked here
    // first so a child isn't left waiting on an upload that will fail.
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(selected.type)) {
      setError(ERROR_MESSAGES.invalid_file);
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setError(ERROR_MESSAGES.too_big);
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function resetChoice() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function analyze() {
    if (!file) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("image", file);
    try {
      const res = await analyzeImageAction(locale, fd);
      setResult(res);
      if (!res.ok) setError(ERROR_MESSAGES[res.error] ?? ERROR_MESSAGES.ai_unavailable);
      else router.refresh();
    } catch {
      setError(ERROR_MESSAGES.network);
    } finally {
      setPending(false);
    }
  }

  const done = result?.ok === true;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
        {/* capture="environment" opens the back camera directly on phones/tablets. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          capture="environment"
          className="hidden"
          aria-label="Фото түсіру"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="hidden"
          aria-label="Галереядан таңдау"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        {!preview && (
          <div className="flex w-full max-w-md gap-3">
            <ChoiceButton icon={Camera} label="Фото түсіру" onClick={() => cameraInputRef.current?.click()} />
            <ChoiceButton icon={ImageIcon} label="Галереядан" onClick={() => galleryInputRef.current?.click()} />
          </div>
        )}

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-56 w-56 rounded-3xl border-4 border-border object-cover shadow-sm" />
        )}

        {preview && !done && (
          <div className="flex w-full max-w-md gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={resetChoice}
              className="flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl border-4 border-border/60 bg-card text-lg font-bold active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className="size-6" /> Басқа фото
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={analyze}
              className="flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-md active:scale-95 disabled:opacity-70"
            >
              {pending ? <Loader2 className="size-6 animate-spin" /> : <Check className="size-6" />}
              {pending ? t("analyzing") : "Иә, тексер!"}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-lg font-semibold">
            {error}
          </p>
        )}

        {result && result.ok && (
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-muted/40 p-4 text-left">
            <div className="flex items-center justify-between">
              <span className="font-heading text-xl font-bold">{result.label}</span>
              <Badge variant="secondary">{t(`kindLabel.${result.kind}` as never)}</Badge>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("confidenceLabel")}</span>
                <span>{Math.round(result.confidence * 100)}%</span>
              </div>
              <Progress value={result.confidence * 100} className="mt-1 h-2" />
            </div>
            <p className="mt-3 text-base">{result.funFact}</p>
            {result.isPotentiallyToxic && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
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
            <div className="mt-4 flex gap-2">
              <Link
                href={`/app/child/ecolab/${result.recognitionId}`}
                className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground"
              >
                🔎 Толығырақ
              </Link>
              <button
                type="button"
                onClick={resetChoice}
                className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl border-2 border-border/60 bg-card text-base font-bold"
              >
                📷 Тағы
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
