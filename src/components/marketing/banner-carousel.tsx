"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CarouselBanner = {
  groupId: string;
  title: string;
  subtitle: string;
  primaryText: string;
  primaryLink: string;
  secondaryText: string | null;
  secondaryLink: string | null;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  backgroundVideoUrl: string | null;
  overlayStrength: number;
  textAlign: "left" | "center" | "right";
  contentPosition: "left" | "center" | "right";
};

const ROTATE_MS = 7000;
const SWIPE_THRESHOLD_PX = 40;

/**
 * Animated hero carousel — auto-rotates through every live (published +
 * enabled + within its start/end window) banner. Pauses on hover, on
 * tab-hidden, and permanently under prefers-reduced-motion (still
 * navigable via the dots/arrows, just no autoplay). The container has a
 * fixed aspect ratio so slide changes never shift page layout.
 */
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BannerCarousel({ banners }: { banners: CarouselBanner[] }) {
  const [rawIndex, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);
  const count = banners.length;
  const index = count > 0 ? ((rawIndex % count) + count) % count : 0;
  const reducedMotion = React.useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

  React.useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const timer = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [count, paused, reducedMotion]);

  React.useEffect(() => {
    function onVisibility() {
      setPaused(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  function go(next: number) {
    setIndex(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === "ArrowRight") go(index + 1);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    go(dx > 0 ? index - 1 : index + 1);
  }

  if (count === 0) return null;

  return (
    <section
      className="relative overflow-hidden border-b border-border/60"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="Бастапқы бет баннерлері"
    >
      <div className="relative aspect-[16/10] w-full sm:aspect-[16/7] md:aspect-[21/8]">
        {banners.map((b, i) => (
          <BannerSlide key={b.groupId} banner={b} active={i === index} priority={i === 0} reducedMotion={reducedMotion} />
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Алдыңғы баннер"
            className="absolute top-1/2 left-3 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Келесі баннер"
            className="absolute top-1/2 right-3 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {banners.map((b, i) => (
              <button
                key={b.groupId}
                type="button"
                onClick={() => go(i)}
                aria-label={`${i + 1}-баннерге өту`}
                aria-current={i === index}
                className={cn(
                  "size-2.5 rounded-full transition-all",
                  i === index ? "w-6 bg-primary" : "bg-foreground/30 hover:bg-foreground/50"
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BannerSlide({
  banner,
  active,
  priority,
  reducedMotion,
}: {
  banner: CarouselBanner;
  active: boolean;
  priority: boolean;
  reducedMotion: boolean;
}) {
  const hasImage = !!banner.desktopImageUrl;

  return (
    <div
      className={cn(
        "absolute inset-0",
        reducedMotion ? "transition-none" : "transition-opacity duration-700 ease-out",
        active ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!active}
    >
      {banner.backgroundVideoUrl ? (
        <video
          src={banner.backgroundVideoUrl}
          className="absolute inset-0 -z-20 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : hasImage ? (
        <>
          <img
            src={banner.desktopImageUrl!}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className={cn("absolute inset-0 -z-20 hidden size-full object-cover", banner.mobileImageUrl ? "sm:block" : "block")}
          />
          {banner.mobileImageUrl && (
            <img
              src={banner.mobileImageUrl}
              alt=""
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              className="absolute inset-0 -z-20 size-full object-cover sm:hidden"
            />
          )}
        </>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 -z-20 opacity-70"
          style={{
            background:
              "radial-gradient(600px circle at 15% 20%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 60%), radial-gradient(500px circle at 85% 0%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 55%)",
          }}
        />
      )}
      {(hasImage || banner.backgroundVideoUrl) && (
        <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: banner.overlayStrength }} />
      )}

      <div
        className={cn(
          "mx-auto flex h-full max-w-6xl flex-col justify-center gap-4 px-4 sm:px-6",
          banner.contentPosition === "center" && "items-center text-center",
          banner.contentPosition === "right" && "items-end text-right",
          banner.contentPosition === "left" && "items-start text-left"
        )}
      >
        <h1
          className={cn(
            "max-w-2xl font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl md:text-5xl",
            (hasImage || banner.backgroundVideoUrl) && "text-white"
          )}
          style={{ textAlign: banner.textAlign }}
        >
          {banner.title}
        </h1>
        {banner.subtitle && (
          <p
            className={cn(
              "max-w-xl text-base text-pretty sm:text-lg",
              hasImage || banner.backgroundVideoUrl ? "text-white/90" : "text-muted-foreground"
            )}
            style={{ textAlign: banner.textAlign }}
          >
            {banner.subtitle}
          </p>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href={banner.primaryLink} className={cn(buttonVariants({ size: "lg" }))}>
            {banner.primaryText}
            <ArrowRight className="size-4" />
          </Link>
          {banner.secondaryText && banner.secondaryLink && (
            <Link
              href={banner.secondaryLink}
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                (hasImage || banner.backgroundVideoUrl) && "border-white/40 bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {banner.secondaryText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
