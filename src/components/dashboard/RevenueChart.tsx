"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface RevenueDataPoint {
  date: string;
  revenue: number;
  appointments: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  loading?: boolean;
}

// ─── Custom Tooltip ──────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-luxury border border-ivory-300 p-3 min-w-[160px]">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
              <span className="text-muted-foreground capitalize">{entry.name}</span>
            </div>
            <span className="font-semibold text-foreground">
              {entry.name === "revenue"
                ? formatCurrency(entry.value)
                : entry.value
              }
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

type ChartView = "revenue" | "appointments" | "both";

export function RevenueChart({ data, loading = false }: RevenueChartProps) {
  const [view, setView] = useState<ChartView>("revenue");

  if (loading) {
    return (
      <div className="card-luxury p-5">
        <div className="skeleton w-40 h-5 rounded mb-4" />
        <div className="skeleton w-full h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="card-luxury p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Revenue Overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 days performance</p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-ivory-100">
          {(["revenue", "appointments", "both"] as ChartView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150 font-medium capitalize"
              style={{
                background: view === v ? "#fff" : "transparent",
                color: view === v ? "#111111" : "#9CA3AF",
                boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#111111" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#111111" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="apptGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#444444" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#444444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#F0E8E4" vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => view === "appointments" ? v : `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
          />

          <Tooltip content={<CustomTooltip />} />

          {(view === "revenue" || view === "both") && (
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#111111"
              strokeWidth={2}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#111111", strokeWidth: 0 }}
            />
          )}

          {(view === "appointments" || view === "both") && (
            <Area
              type="monotone"
              dataKey="appointments"
              stroke="#444444"
              strokeWidth={2}
              fill="url(#apptGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#444444", strokeWidth: 0 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
