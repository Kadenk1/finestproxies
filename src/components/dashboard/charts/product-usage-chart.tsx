"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  boxShadow: "0 8px 24px -12px rgba(15,28,51,0.18)",
  fontSize: 12,
  color: "var(--navy-900)",
};

// Fixed categorical order — color follows the product identity, never rank.
const PRODUCT_COLOR: Record<string, string> = {
  "Residential Proxies": "var(--chart-1)",
  "ISP Proxies": "var(--chart-2)",
  "Mobile Proxies": "var(--chart-3)",
};
const FALLBACK_COLOR = "var(--chart-4)";

export function ProductUsageChart({ data }: { data: { name: string; gb: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fontSize: 12, fill: "var(--navy-700)" }}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} GB`, "Usage"]} />
        <Bar dataKey="gb" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={PRODUCT_COLOR[entry.name] ?? FALLBACK_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
