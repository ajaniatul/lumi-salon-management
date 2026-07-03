"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ServiceStat {
  name: string;
  count: number;
  revenue: number;
}

interface TopServicesProps {
  services: ServiceStat[];
  loading?: boolean;
}

// Rose-gold palette for chart slices
const COLORS = ["#B76E79", "#C4956A", "#D4A0A7", "#DBA98E", "#E8C4C8", "#F0D5BB"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white rounded-xl shadow-luxury border border-ivory-300 p-3 text-sm">
        <p className="font-medium text-foreground">{d.name}</p>
        <p className="text-muted-foreground">{d.count} bookings</p>
        <p className="font-semibold mt-0.5" style={{ color: "#B76E79" }}>
          {formatCurrency(d.revenue)}
        </p>
      </div>
    );
  }
  return null;
};

export function TopServices({ services, loading = false }: TopServicesProps) {
  if (loading) {
    return (
      <div className="card-luxury p-5">
        <div className="skeleton w-32 h-5 rounded mb-4" />
        <div className="skeleton w-full h-48 rounded-xl" />
      </div>
    );
  }

  const total = services.reduce((s, item) => s + item.revenue, 0);

  return (
    <div className="card-luxury p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top Services</h3>
        <p className="text-xs text-muted-foreground mt-0.5">By revenue this month</p>
      </div>

      {services.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-xs text-muted-foreground">No data yet</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Pie chart */}
          <div className="flex-shrink-0">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={services}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="revenue"
                >
                  {services.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0 space-y-2.5">
            {services.slice(0, 5).map((service, i) => {
              const pct = total > 0 ? ((service.revenue / total) * 100).toFixed(0) : 0;
              return (
                <div key={service.name} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-xs text-foreground truncate flex-1">
                    {service.name}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
