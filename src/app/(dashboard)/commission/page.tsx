"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type StaffCommission = {
  id: string; dbId: string; name: string; designation: string;
  salary: number; commissionRate: number;
  svcRevenue: number; commissionAmt: number; bonusAmt: number;
  totalVariable: number; grossPay: number;
  isPaid: boolean; commissionDbId: string | null;
  appointments: number; topService: string | null;
};

type Summary = {
  totalCommission: number; totalGross: number; totalPending: number;
  topEarner: string | null; topEarnerAmt: number;
};

export default function CommissionPage() {
  const now = new Date();
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [year,        setYear]        = useState(now.getFullYear());
  const [data,        setData]        = useState<StaffCommission[]>([]);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<string | null>(null);
  const [marking,     setMarking]     = useState<string | null>(null);
  const [toast,       setToast]       = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/commission?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setData(j.data);
          setSummary(j.summary);
          setSelected(s => s ?? j.data[0]?.id ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const markPaid = async (c: StaffCommission) => {
    setMarking(c.dbId);
    try {
      const res = await fetch("/api/commission", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          staffDbId:     c.dbId,
          month, year,
          svcRevenue:    c.svcRevenue,
          commissionAmt: c.commissionAmt,
          bonusAmt:      c.bonusAmt,
          totalAmt:      c.totalVariable,
        }),
      });
      const j = await res.json();
      if (j.success) {
        setData(prev => prev.map(x => x.dbId === c.dbId ? { ...x, isPaid: true } : x));
        setSummary(prev => prev ? { ...prev, totalPending: prev.totalPending - c.grossPay } : prev);
        setToast(`Payout marked complete for ${c.name}`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch {}
    setMarking(null);
  };

  const rec = data.find(c => c.id === selected) ?? data[0] ?? null;

  return (
    <div className="space-y-5">

      {/* ── Month nav ── */}
      <div className="flex items-center gap-1">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-ivory-200 transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-bold text-foreground px-2 min-w-[110px] text-center">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-ivory-200 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* ── KPI chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Commission",  value: summary ? `₹${summary.totalCommission.toLocaleString("en-IN")}` : "—", desc: "All stylists this month" },
          { label: "Total Gross Payroll",value: summary ? `₹${summary.totalGross.toLocaleString("en-IN")}` : "—",     desc: "Salary + Commission + Bonus" },
          { label: "Pending Payout",    value: summary ? `₹${summary.totalPending.toLocaleString("en-IN")}` : "—",    desc: "Yet to be disbursed" },
          { label: "Highest Commission",value: summary?.topEarner ?? "—", desc: summary ? `₹${summary.topEarnerAmt.toLocaleString("en-IN")} earned` : "" },
        ].map(s => (
          <div key={s.label} className="card-luxury p-4">
            <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-xs font-semibold text-foreground mt-1">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#B76E79" }} />
          <p className="text-sm text-muted-foreground">Loading commissions…</p>
        </div>
      ) : data.length === 0 ? (
        <div className="card-luxury p-12 text-center">
          <p className="text-sm text-muted-foreground">No staff data available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Staff list ── */}
          <div className="lg:col-span-1 space-y-2">
            {data.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className={cn("w-full text-left p-3.5 rounded-2xl border transition-all",
                  (selected ?? data[0]?.id) === c.id
                    ? "border-primary-300 bg-primary-50"
                    : "bg-white border-ivory-300 hover:border-primary-200"
                )}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.designation}{c.commissionRate > 0 ? ` · ${c.commissionRate}% commission` : " · Fixed salary"}
                    </p>
                  </div>
                  <span className={cn("badge text-[10px] flex-shrink-0 ml-2",
                    c.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {c.isPaid ? "Paid" : "Pending"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{c.appointments} appointments</p>
                  <p className="text-sm font-bold" style={{ color: "#B76E79" }}>
                    ₹{c.grossPay.toLocaleString("en-IN")}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* ── Detail panel ── */}
          {rec && (
            <div className="lg:col-span-2">
              <div className="card-luxury p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-base font-bold text-foreground">{rec.name}</h3>
                    <span className={cn("badge text-xs",
                      rec.isPaid
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : "bg-amber-100 text-amber-700 border border-amber-200"
                    )}>
                      {rec.isPaid ? "✓ Payout Completed" : "⏳ Payout Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rec.designation}
                    {rec.commissionRate > 0 ? ` · ${rec.commissionRate}% commission on service revenue` : " · Fixed salary, no commission"}
                  </p>
                  {rec.topService && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Top service: <strong className="text-foreground">{rec.topService}</strong>
                    </p>
                  )}
                </div>

                {/* Commission breakdown */}
                <div className="bg-ivory-50 rounded-xl p-4 border border-ivory-200 space-y-3">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                    Commission Calculation — {MONTH_NAMES[month - 1]} {year}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Service revenue ({rec.appointments} appointments)
                    </span>
                    <span className="font-medium">₹{rec.svcRevenue.toLocaleString("en-IN")}</span>
                  </div>
                  {rec.commissionRate > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Commission ({rec.commissionRate}% × ₹{rec.svcRevenue.toLocaleString("en-IN")})
                      </span>
                      <span className="font-medium text-emerald-600">
                        ₹{rec.commissionAmt.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No commission — fixed salary only</p>
                  )}
                  {rec.bonusAmt > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Performance bonus</span>
                      <span className="font-medium text-emerald-600">₹{rec.bonusAmt.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="border-t border-ivory-300 pt-2 flex justify-between text-sm font-semibold">
                    <span>Total Variable Pay</span>
                    <span style={{ color: "#B76E79" }}>₹{rec.totalVariable.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Total payout */}
                <div className="bg-ivory-50 rounded-xl p-4 border border-ivory-200 space-y-2">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                    Total {MONTH_NAMES[month - 1]} Payout
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fixed monthly salary</span>
                    <span className="font-medium">₹{rec.salary.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Variable pay</span>
                    <span className="font-medium">₹{rec.totalVariable.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="border-t border-ivory-300 pt-2 flex justify-between text-base font-bold">
                    <span>Gross Pay</span>
                    <span style={{ color: "#B76E79" }}>₹{rec.grossPay.toLocaleString("en-IN")}</span>
                  </div>
                  {!rec.isPaid && (
                    <div className="flex justify-between text-sm font-semibold text-red-500">
                      <span>Pending disbursement</span>
                      <span>₹{rec.grossPay.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>

                {!rec.isPaid && (
                  <button onClick={() => markPaid(rec)} disabled={marking === rec.dbId}
                    className="btn-primary text-xs py-2 px-4 w-fit flex items-center gap-2 disabled:opacity-60">
                    {marking === rec.dbId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {marking === rec.dbId ? "Saving…" : "Mark Payout Completed"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-2xl shadow-lg">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
