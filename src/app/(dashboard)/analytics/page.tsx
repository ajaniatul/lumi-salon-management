"use client";
import { useState, useEffect } from "react";
import { Repeat, Users, Clock, Star, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type Segment = { label: string; count: number; desc: string; color: string; action: string };
type Insight = { type: string; icon: string; title: string; desc: string };
type RetentionMonth = { month: string; new: number; retained: number; churned: number };
type Stylist = { name: string; appts: number; revenue: number; avgRating: number | null; repeatRate: number; retention: string };

type AnalyticsData = {
  kpis: { retentionRate: number; avgClv: number; newThisMonth: number; newVsLastMonth: number; peakWindow: string };
  insights: Insight[];
  customerSegments: Segment[];
  retentionData: RetentionMonth[];
  stylistPerformance: Stylist[];
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json.data);
        else toast.error(json.error ?? "Failed to load analytics.");
      })
      .catch(() => toast.error("Failed to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#111111" }} />
      <p className="text-sm text-muted-foreground">Crunching the numbers…</p>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64">
      <p className="text-sm text-red-500">Could not load analytics.</p>
    </div>
  );

  const { kpis, insights, customerSegments, retentionData, stylistPerformance } = data;
  const totalSegmented = customerSegments.reduce((s, c) => s + c.count, 0) || 1;

  const kpiCards = [
    { label: "Customer Retention Rate", value: `${kpis.retentionRate}%`, desc: "Customers who returned within 60 days", icon: Repeat, trend: "Based on real visit history", up: true },
    { label: "Avg. Customer Value (6mo)", value: `₹${kpis.avgClv.toLocaleString("en-IN")}`, desc: "Avg. spend among customers active in the last 6 months", icon: Users, trend: "Live from invoices", up: true },
    { label: "New Customer Acquisition", value: `${kpis.newThisMonth}/month`, desc: "First-time signups this month", icon: Star, trend: `${kpis.newVsLastMonth >= 0 ? "+" : ""}${kpis.newVsLastMonth} vs last month`, up: kpis.newVsLastMonth >= 0 },
    { label: "Peak Booking Hours", value: kpis.peakWindow, desc: "Highest appointment density window", icon: Clock, trend: "All-time appointment data", up: true },
  ];

  return (
    <div className="px-6 space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Analytics & Insights</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Customer segmentation, retention trends and stylist performance — computed live from your salon&apos;s real data.</p>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map(s => (
          <div key={s.label} className="card-luxury p-4">
            <s.icon className="w-5 h-5 mb-2" style={{ color:"#111111" }} />
            <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-xs font-semibold text-foreground mt-1">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.desc}</p>
            <p className={cn("text-[10px] font-semibold mt-1", s.up?"text-emerald-600":"text-red-500")}>{s.trend}</p>
          </div>
        ))}
      </div>

      {/* Insights Feed */}
      <div className="card-luxury p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Business Insights & Recommendations</p>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No notable signals right now — check back as more bookings and sales come in.</p>
        ) : (
          <div className="space-y-3">
            {insights.map((ins,i) => (
              <div key={i} className={cn("p-4 rounded-xl border flex items-start gap-3",
                ins.type==="alert"?"bg-red-50 border-red-200":
                ins.type==="opportunity"?"bg-amber-50 border-amber-200":"bg-emerald-50 border-emerald-200"
              )}>
                <span className="text-xl">{ins.icon}</span>
                <div className="flex-1">
                  <p className={cn("text-sm font-semibold",
                    ins.type==="alert"?"text-red-700":ins.type==="opportunity"?"text-amber-700":"text-emerald-700"
                  )}>{ins.title}</p>
                  <p className={cn("text-xs mt-0.5 leading-relaxed",
                    ins.type==="alert"?"text-red-600":ins.type==="opportunity"?"text-amber-600":"text-emerald-600"
                  )}>{ins.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Segmentation */}
        <div className="card-luxury p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Customer Segmentation <span className="font-normal text-muted-foreground text-xs">— RFM Model</span></p>
          <p className="text-xs text-muted-foreground mb-3">Customers grouped by recency (last visit), frequency (how often), and monetary value (spend). Each segment needs a different strategy.</p>
          <div className="space-y-3">
            {customerSegments.map(seg => (
              <div key={seg.label}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-xs font-semibold text-foreground">{seg.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">({seg.count} customers)</span>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-lg border border-ivory-300 text-muted-foreground">{seg.action}</span>
                </div>
                <div className="h-2 bg-ivory-200 rounded-full mb-1">
                  <div className="h-2 rounded-full" style={{ width:`${(seg.count/totalSegmented)*100}%`, background:seg.color }} />
                </div>
                <p className="text-[10px] text-muted-foreground">{seg.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Retention Chart */}
        <div className="card-luxury p-5">
          <p className="text-sm font-semibold text-foreground mb-1">Customer Retention Trend</p>
          <p className="text-xs text-muted-foreground mb-4">New vs retained vs churned customers per month. Churn for the current month is still unfolding, so it isn&apos;t counted yet.</p>
          <div className="space-y-2">
            {retentionData.map(m => {
              const total = m.retained + m.new + m.churned || 1;
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <p className="text-xs font-semibold text-muted-foreground w-6">{m.month}</p>
                  <div className="flex-1 flex gap-1 h-6">
                    <div className="rounded-l-md" title={`Retained: ${m.retained}`}
                      style={{ width:`${(m.retained/total)*100}%`, background:"#10B981" }} />
                    <div title={`New: ${m.new}`}
                      style={{ width:`${(m.new/total)*100}%`, background:"#111111" }} />
                    <div className="rounded-r-md" title={`Churned: ${m.churned}`}
                      style={{ width:`${(m.churned/total)*100}%`, background:"#F3E8EB" }} />
                  </div>
                  <p className="text-xs text-muted-foreground w-8">{m.retained+m.new}</p>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4">
            {[{color:"#10B981",label:"Retained"},{color:"#111111",label:"New"},{color:"#F3E8EB",label:"Churned"}].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background:l.color, border:l.color==="#F3E8EB"?"1px solid #E5DDE0":"none" }} />
                <p className="text-[10px] text-muted-foreground">{l.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stylist Performance */}
      <div className="card-luxury overflow-hidden">
        <div className="p-4 border-b border-ivory-200">
          <p className="text-sm font-semibold text-foreground">Stylist Performance Benchmarks — This Month</p>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue generated, manager-set rating and repeat booking rate per stylist. Use to identify top performers and coach others.</p>
        </div>
        {stylistPerformance.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No active staff to benchmark yet.</p>
        ) : (
        <table className="table-luxury">
          <thead>
            <tr>
              <th>Stylist Name</th>
              <th>Appointments</th>
              <th>Revenue Generated</th>
              <th>Rating</th>
              <th>Repeat Client Rate</th>
              <th>Retention Quality</th>
            </tr>
          </thead>
          <tbody>
            {stylistPerformance.map((s) => (
              <tr key={s.name}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background:"linear-gradient(135deg,#111111,#444444)" }}>
                      {s.name.split(" ").map(n=>n[0]).join("")}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  </div>
                </td>
                <td><p className="text-sm text-foreground">{s.appts}</p></td>
                <td><p className="text-sm font-bold" style={{ color:"#111111" }}>₹{s.revenue.toLocaleString("en-IN")}</p></td>
                <td>
                  {s.avgRating !== null ? (
                    <div className="flex items-center gap-1">
                      <span className="text-amber-400">★</span>
                      <p className="text-sm font-semibold text-foreground">{s.avgRating.toFixed(1)}</p>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">Not rated</p>}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-ivory-200 rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width:`${s.repeatRate}%`, background:"#111111" }} />
                    </div>
                    <p className="text-xs font-bold text-foreground">{s.repeatRate}%</p>
                  </div>
                </td>
                <td>
                  <span className={cn("badge text-[10px]",
                    s.retention==="Excellent"?"bg-emerald-100 text-emerald-700":
                    s.retention==="Good"?"bg-blue-100 text-blue-700":"bg-amber-100 text-amber-700"
                  )}>{s.retention}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
