'use client';

import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip} from 'recharts';

// Orders-by-status donut (Phase 5 dashboard). Client component (recharts). Fed
// plain serializable slices with explicit per-status colors matching the
// OrderStatusBadge palette (amber/blue/green/red) — passed from the server page.
// The center total + the legend live in the parent (normal HTML) so they mirror
// correctly under RTL; this component draws only the ring. Tooltip styling uses
// CSS-var strings so it tracks the theme. Empty state when every status is zero.

export type DonutSlice = {status: string; label: string; value: number; color: string};

export function StatusDonut({
  data,
  emptyLabel,
  tooltipBg,
  tooltipBorder,
  tooltipText
}: {
  data: DonutSlice[];
  emptyLabel: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div dir="ltr" className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="90%"
            paddingAngle={2}
            strokeWidth={0}
            startAngle={90}
            endAngle={-270}
          >
            {slices.map((slice) => (
              <Cell key={slice.status} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: 8,
              color: tooltipText,
              fontSize: 12
            }}
            labelStyle={{color: tooltipText}}
            itemStyle={{color: tooltipText}}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
