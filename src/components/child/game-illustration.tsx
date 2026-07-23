import { renderIcon } from "@/lib/marketing/icon-map";
import { cn } from "@/lib/utils";

/**
 * A self-contained "illustration" for a game card — no image assets to
 * source or upload, just a colored gradient (derived from the game's
 * own `color`) behind a large icon. Matches the radial-gradient
 * treatment already used for the homepage hero background.
 */
export function GameIllustration({
  color,
  icon,
  size = "md",
  className,
}: {
  color: string;
  icon: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: { box: "size-14", icon: "size-6" },
    md: { box: "size-20", icon: "size-9" },
    lg: { box: "size-28", icon: "size-12" },
  }[size];

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-3xl text-white shadow-md",
        sizes.box,
        className
      )}
      style={{
        background: `radial-gradient(120% 120% at 25% 15%, color-mix(in oklch, ${color} 55%, white) 0%, ${color} 65%)`,
      }}
    >
      <div className={sizes.icon}>{renderIcon(icon, "size-full")}</div>
    </div>
  );
}
