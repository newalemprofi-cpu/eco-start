"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CarouselNewsItem = {
  groupId: string;
  slug: string;
  title: string;
  excerpt: string;
  dateLabel: string;
  imageUrl: string | null;
};

const ROTATE_MS = 7000;
const SWIPE_THRESHOLD_PX = 40;

/**
 * Homepage hero — self-contained sibling of banner-carousel.tsx (same
 * rotation/pause/swipe/dots contract), not a shared refactor of it:
 * copying the interaction shell carries far less risk than making the
 * already-verified BannerCarousel generic, and the two are expected to
 * diverge further (this one wraps the whole slide in a Link to the
 * article, on top of its own "Толығырақ оқу" button — the marketing
 * banner has no single-destination "the whole slide is one link"
 * requirement).
 */
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function NewsCarousel({ items }: { items: CarouselNewsItem[] }) {
  const [rawIndex, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);
  const count = items.length;
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
      aria-label="Жаңалықтар каруселі"
    >
      <div className="relative aspect-[16/10] w-full sm:aspect-[16/7] md:aspect-[21/8]">
        {items.map((item, i) => (
          <NewsSlide key={item.groupId} item={item} active={i === index} priority={i === 0} reducedMotion={reducedMotion} />
        ))}
      </div>

      {count > 1 && (
        <>
          {/* Pinned to the top corners rather than vertically centered:
           * on short mobile slide heights (aspect-[16/10]) a
           * vertically-centered button lands right on top of the
           * bottom-anchored excerpt text and overlaps it. */}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Алдыңғы жаңалық"
            className="absolute top-3 left-3 z-20 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Келесі жаңалық"
            className="absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {items.map((item, i) => (
              <button
                key={item.groupId}
                type="button"
                onClick={() => go(i)}
                aria-label={`${i + 1}-жаңалыққа өту`}
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

function NewsSlide({
  item,
  active,
  priority,
  reducedMotion,
}: {
  item: CarouselNewsItem;
  active: boolean;
  priority: boolean;
  reducedMotion: boolean;
}) {
  const hasImage = !!item.imageUrl;
  const href = `/news/${item.slug}`;

  return (
    <div
      className={cn(
        "absolute inset-0",
        reducedMotion ? "transition-none" : "transition-opacity duration-700 ease-out",
        active ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!active}
    >
      {/* The whole slide is clickable (spec requirement) — a Link that
       * fills the slide, with the visible content layered on top of it. */}
      <Link href={href} className="absolute inset-0" aria-label={item.title}>
        {hasImage ? (
          <img
            src={item.imageUrl!}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="absolute inset-0 -z-20 size-full object-cover"
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-0 -z-20 opacity-70"
            style={{
              background:
                "radial-gradient(600px circle at 15% 20%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 60%), radial-gradient(500px circle at 85% 0%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 55%)",
            }}
          />
        )}
        {hasImage && <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />}
      </Link>

      <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-6xl flex-col justify-end gap-3 px-4 pb-14 sm:px-6 sm:pb-16">
        {item.dateLabel && (
          <span className={cn("text-xs font-semibold tracking-wide uppercase", hasImage ? "text-white/80" : "text-primary")}>
            {item.dateLabel}
          </span>
        )}
        <h1
          className={cn(
            "max-w-2xl font-heading text-2xl font-extrabold tracking-tight text-balance sm:text-4xl",
            hasImage && "text-white"
          )}
        >
          {item.title}
        </h1>
        {item.excerpt && (
          <p className={cn("max-w-xl text-sm text-pretty sm:text-base", hasImage ? "text-white/90" : "text-muted-foreground")}>
            {item.excerpt}
          </p>
        )}
        <div className={cn("pt-1", active ? "pointer-events-auto" : "pointer-events-none")}>
          <Link href={href} className={cn(buttonVariants({ size: "lg" }))}>
            Толығырақ оқу
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
