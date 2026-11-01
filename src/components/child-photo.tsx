"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A child's private photo (served through /uploads → /api/media with
 * the viewer's session cookie). When the request fails — 401 (session
 * ended), 404 (no access, or the file is physically gone) — it shows an
 * honest "photo unavailable" tile instead of the browser's broken-image
 * icon. It never substitutes a different picture.
 */
export function ChildPhoto({ src, alt = "", className }: { src: string | null; alt?: string; className?: string }) {
  // Remember *which* src failed, so a new src (router.refresh after an
  // upload) automatically gets a fresh attempt.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label="Сурет қолжетімсіз"
        className={cn("flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground", className)}
      >
        <ImageOff className="size-6" aria-hidden />
        <span className="px-2 text-center text-[11px] font-medium leading-tight">Сурет ашылмады</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(el) => {
        // A server-rendered <img> can fail before React hydrates and
        // attaches onError — that error is never replayed. Catch it here:
        // "complete" with no pixels means the load already failed.
        if (el && el.complete && el.naturalWidth === 0) setFailedSrc(src);
      }}
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
