"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GrowthLog } from "@/db/repo/greenhouse";

export function GrowthChart({ logs }: { logs: GrowthLog[] }) {
  // Centimetres when the child measured them; otherwise the leaf
  // counts tapped in the picture form, so 3-4 year-olds get a chart too.
  const useHeight = logs.some((l) => l.heightCm != null);
  const data = logs
    .filter((l) => (useHeight ? l.heightCm != null : l.leafCount != null))
    .map((l) => ({ date: l.loggedAt.slice(5, 10), height: Number(useHeight ? l.heightCm : l.leafCount) }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        —
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--module-greenhouse)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--module-greenhouse)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={32} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="height"
            name={useHeight ? "см" : "жапырақ"}
            stroke="var(--module-greenhouse)"
            strokeWidth={2}
            fill="url(#growthFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
