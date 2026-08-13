'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

// Sales Overview chart (Minimal-UI pass). Client component: recharts needs the
// browser. It receives ONLY plain serializable data + colour STRINGS from the
// server page — never DB rows, never a hardcoded hex. Every colour arrives as a
// `var(--token)` string so light/dark (and any future palette change) track
// automatically; SVG presentation attributes resolve var() natively.
//
// The look is the kit's ApexCharts area: a smooth 2px curve over a vertical
// gradient fading 40% → 0, no axis lines and no tick marks, horizontal-only
// dashed grid rules in the divider colour, and muted 12px labels held off the
// plot by a generous tick margin.
//
// The series is order COUNT (all statuses), labelled by the parent —
// deliberately NOT reconciled with the revenue KPI tile (different
// windows/bases by design). Wrapped in dir="ltr" so the time axis renders
// left-to-right even under RTL (numbers/times are inherently LTR).

export type SalesChartPoint = {label: string; count: number; revenueMillimes: number};

// Stable gradient id: one instance per page, and a fixed id keeps the fill
// reference valid across re-renders.
const FILL_ID = 'admin-sales-fill';

export function SalesChart({
  data,
  seriesLabel,
  emptyLabel,
  accentColor,
  axisColor,
  gridColor,
  surfaceColor,
  tooltipBg,
  tooltipText
}: {
  data: SalesChartPoint[];
  seriesLabel: string;
  emptyLabel: string;
  /** Curve + gradient colour, e.g. 'var(--primary)'. */
  accentColor: string;
  axisColor: string;
  gridColor: string;
  /** Card surface, used to ring the active dot so it reads as a knob. */
  surfaceColor: string;
  tooltipBg: string;
  tooltipText: string;
}) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const tickStyle = {fill: axisColor, fontSize: 12, fontWeight: 500} as const;

  return (
    // h-full: the parent card decides the height (it stretches to the row).
    <div dir="ltr" className="h-full min-h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{top: 12, right: 12, bottom: 0, left: 0}}>
          <defs>
            <linearGradient id={FILL_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Horizontal rules only, dashed, in the divider colour. */}
          <CartesianGrid stroke={gridColor} strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={gridColor}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={gridColor}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            cursor={{stroke: axisColor, strokeDasharray: '4 4', strokeWidth: 1}}
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
            formatter={(value) => [value, seriesLabel]}
          />
          <Area
            type="monotone"
            dataKey="count"
            name={seriesLabel}
            stroke={accentColor}
            strokeWidth={2}
            fill={`url(#${FILL_ID})`}
            dot={false}
            activeDot={{r: 5, fill: accentColor, stroke: surfaceColor, strokeWidth: 3}}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
