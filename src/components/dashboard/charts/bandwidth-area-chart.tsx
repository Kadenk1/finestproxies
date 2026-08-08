"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  boxShadow: "0 8px 24px -12px rgba(15,28,51,0.18)",
  fontSize: 12,
  color: "var(--navy-900)",
};

export function BandwidthAreaChart({ data }: { data: { date: string; gb: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="bandwidthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={40}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [`${Number(value).toFixed(2)} GB`, "Bandwidth"]}
        />
        <Area
          type="monotone"
          dataKey="gb"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#bandwidthFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
