'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface OrdersActivityPoint {
  label: string;
  created: number;
  shipped: number;
}

export function OrdersActivityChart({ data }: { data: OrdersActivityPoint[] }) {
  return (
    <div className="h-64 border border-border bg-card px-2 py-4 sm:px-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 0,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="created"
            name="Created"
            fill="hsl(var(--primary))"
            radius={0}
          />
          <Bar
            dataKey="shipped"
            name="Shipped"
            fill="hsl(var(--muted-foreground) / 0.45)"
            radius={0}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
