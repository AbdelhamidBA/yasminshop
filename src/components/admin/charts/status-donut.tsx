'use client';

import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip} from 'recharts';

// Orders-by-status donut (Minimal-UI pass). Client component (recharts), fed
// plain serializable slices whose colours are `var(--admin-*)` token strings
// passed from the server page — the same inks the StatusLabel chips use, so a
// slice and its status pill can never drift apart. No hex lives here.
//
// The kit's donut is a THICK RING: ~70% inner radius, segments separated by a
// hairline in the surface colour rather than a gap, and the total centred
// inside. The centre figure + the legend live in the parent (normal HTML) so
// they mirror correctly under RTL; this component draws only the ring.

export type DonutSlice = {status: string; label: string; value: number; color: string};

export function StatusDonut({
  data,
  emptyLabel,
  surfaceColor,
  tooltipBg,
  tooltipText
}: {
  data: DonutSlice[];
  emptyLabel: string;
  /** Card surface — separates adjacent segments without a visible gap. */
  surfaceColor: string;
  tooltipBg: string;
  tooltipText: string;
}) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div dir="ltr" className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="70%"
            outerRadius="96%"
            paddingAngle={0}
            stroke={surfaceColor}
            strokeWidth={3}
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
              border: 'none',
              borderRadius: 10,
              boxShadow: 'var(--shadow-float)',
              color: tooltipText,
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px'
            }}
            labelStyle={{color: tooltipText, fontWeight: 700, marginBottom: 2}}
            itemStyle={{color: tooltipText}}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
