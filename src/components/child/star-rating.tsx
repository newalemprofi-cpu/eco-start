"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 1–3 stars based on how well a round went — a picture-only result
 * indicator that needs no reading, popping in one at a time. `sm` is
 * a static (non-animated) variant for compact spots like hub cards. */
export function StarRating({ earned, size = "lg" }: { earned: 1 | 2 | 3; size?: "sm" | "lg" }) {
  if (size === "sm") {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3].map((n) => (
          <Star key={n} className={cn("size-3.5 fill-current", n <= earned ? "text-warning" : "text-muted-foreground/25")} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-10 animate-in zoom-in-50 fill-current duration-500 sm:size-12",
            n <= earned ? "text-warning" : "text-muted-foreground/25"
          )}
          style={{ animationDelay: `${(n - 1) * 180}ms`, animationFillMode: "backwards" }}
        />
      ))}
    </div>
  );
}
