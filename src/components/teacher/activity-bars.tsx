import { cn } from "@/lib/utils";

/** Tiny dependency-free bar strip for "activity dynamics" — server
 * rendered, one bar per day, height relative to the busiest day. */
export function ActivityBars({
  values,
  labels,
  className,
  tall,
}: {
  values: number[];
  labels?: string[];
  className?: string;
  tall?: boolean;
}) {
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div
      className={cn("flex items-end gap-0.5", tall ? "h-24" : "h-6", className)}
      role="img"
      aria-label={`Соңғы ${values.length} күнде ${total} әрекет`}
    >
      {values.map((v, i) => (
        <div
          key={i}
          title={labels ? `${labels[i]}: ${v}` : String(v)}
          className={cn("flex-1 rounded-sm", v > 0 ? "bg-module-analytics" : "bg-muted")}
          style={{ height: `${v > 0 ? Math.max(12, (v / max) * 100) : 8}%` }}
        />
      ))}
    </div>
  );
}
