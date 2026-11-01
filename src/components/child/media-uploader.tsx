"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ImageIcon, Loader2, RotateCcw } from "lucide-react";
import { uploadMediaAction } from "@/app/[locale]/app/child/studio/actions";
import { Card, CardContent } from "@/components/ui/card";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage/types";
import { cn } from "@/lib/utils";

// Tap-only title instead of a text field the child can't fill in.
const TITLE_PRESETS = [
  { emoji: "🌳", label: "Табиғат" },
  { emoji: "🐾", label: "Жануар" },
  { emoji: "🌸", label: "Гүл" },
  { emoji: "🎨", label: "Менің суретім" },
] as const;

const ERRORS: Record<string, string> = {
  invalid: "📷 Алдымен фото таңда",
  invalid_file: "🖼️ Бұл фото ашылмады. Басқа фото таңда",
  too_big: "🐘 Фото тым үлкен. Басқа фото таңда",
  network: "📶 Байланыс жоқ. Тағы бас!",
};

export function MediaUploader({ locale }: { locale: string }) {
  const router = useRouter();
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState<string>(TITLE_PRESETS[0].label);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(selected: File | undefined) {
    setMessage(null);
    if (!selected) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(selected.type)) return setMessage(ERRORS.invalid_file);
    if (selected.size > MAX_IMAGE_BYTES) return setMessage(ERRORS.too_big);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function reset() {
    setFile(null);
    setPreview(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function upload() {
    if (!file) return;
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("file", file);
    try {
      const res = await uploadMediaAction(locale, fd);
      if (res.ok) {
        reset();
        setMessage("🎉 Сақталды! +6 XP");
        router.refresh();
      } else {
        setMessage(ERRORS[res.error] ?? ERRORS.invalid_file);
      }
    } catch {
      setMessage(ERRORS.network);
    } finally {
      setPending(false);
    }
  }

  const big =
    "flex min-h-24 flex-1 flex-col items-center justify-center gap-1 rounded-3xl border-4 p-3 text-base font-bold transition active:scale-95 disabled:opacity-50";

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
        <input
          ref={cameraRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          capture="environment"
          className="hidden"
          aria-label="Фото түсіру"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="hidden"
          aria-label="Галереядан таңдау"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        {!preview ? (
          <div className="flex w-full max-w-md gap-3">
            <button type="button" className={cn(big, "border-module-media/40 bg-module-media/10")} onClick={() => cameraRef.current?.click()}>
              <Camera className="size-10 text-module-media" />
              Фото түсіру
            </button>
            <button type="button" className={cn(big, "border-module-media/40 bg-module-media/10")} onClick={() => galleryRef.current?.click()}>
              <ImageIcon className="size-10 text-module-media" />
              Галереядан
            </button>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-48 w-48 rounded-3xl border-4 border-border object-cover" />
            <div className="grid w-full max-w-md grid-cols-4 gap-2">
              {TITLE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={title === p.label}
                  onClick={() => setTitle(p.label)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border-4 p-2 transition active:scale-95",
                    title === p.label ? "border-primary bg-primary/10" : "border-border/60 bg-card"
                  )}
                >
                  <span className="text-3xl" aria-hidden>
                    {p.emoji}
                  </span>
                  <span className="text-[11px] font-bold">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="flex w-full max-w-md gap-3">
              <button type="button" disabled={pending} onClick={reset} className={cn(big, "min-h-16 flex-row border-border/60 bg-card")}>
                <RotateCcw className="size-6" /> Басқа фото
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={upload}
                className={cn(big, "min-h-16 flex-row border-primary bg-primary text-primary-foreground")}
              >
                {pending ? <Loader2 className="size-6 animate-spin" /> : <Check className="size-6" />}
                Сақтау
              </button>
            </div>
          </>
        )}
        {message && (
          <p role="status" className="text-lg font-semibold">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
