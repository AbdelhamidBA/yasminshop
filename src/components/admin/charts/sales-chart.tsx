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

// Sales Overview chart (Phase 5 dashboard). Client component: recharts needs the
// browser. It receives ONLY plain serializable data + explicit color strings from
// the server page — never DB rows. Structural colors are CSS-var strings (theme
// tokens) so light/dark both work; the accent is an explicit brand green passed
// as a prop. The series is order COUNT (all statuses), labelled "Orders" by the
// parent — deliberately NOT reconciled with the revenue KPI tile (different
// windows/bases by design). Wrapped in dir="ltr" so the time axis renders
// left-to-right even under RTL (numbers/times are inherently LTR).

export type SalesChartPoint = {label: string; count: number; revenueMillimes: number};

export function SalesChart({
  data,
  seriesLabel,
  emptyLabel,
  strokeColor,
  fillColor,
  axisColor,
  gridColor,
  tooltipBg,
  tooltipBorder,
  tooltipText
}: {
  data: SalesChartPoint[];
  seriesLabel: string;
  emptyLabel: string;
  strokeColor: string;
  fillColor: string;
  axisColor: string;
  gridColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{top: 8, right: 8, bottom: 0, left: -16}}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={axisColor}
            tick={{fill: axisColor, fontSize: 12}}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis
            stroke={axisColor}
            tick={{fill: axisColor, fontSize: 12}}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            cursor={{stroke: gridColor}}
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: 8,
              color: tooltipText,
              fontSize: 12
            }}
            labelStyle={{color: tooltipText}}
            itemStyle={{color: tooltipText}}
            formatter={(value) => [value, seriesLabel]}
          />
          <Area
            type="monotone"
            dataKey="count"
            name={seriesLabel}
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#salesFill)"
            activeDot={{r: 4, fill: strokeColor}}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
