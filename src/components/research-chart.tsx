"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ObservationPoint } from "@/db/repo/research";

const SERIES_COLORS = ["var(--module-research)", "var(--module-game)", "var(--module-media)", "var(--primary)"];

export function ResearchChart({ observations }: { observations: ObservationPoint[] }) {
  const children = [...new Set(observations.map((o) => o.childName))];
  const dates = [...new Set(observations.map((o) => o.loggedAt))].sort();

  const data = dates.map((date) => {
    const row: Record<string, string | number> = { date: date.slice(5, 10) };
    for (const child of children) {
      const point = observations.find((o) => o.loggedAt === date && o.childName === child);
      if (point?.measurement != null) row[child] = point.measurement;
    }
    return row;
  });

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        —
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {children.map((child, i) => (
            <Line
              key={child}
              type="monotone"
              dataKey={child}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
