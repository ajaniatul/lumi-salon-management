"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, Calendar, Star, Briefcase,
  TrendingUp, Clock, ChevronRight, Loader2, Users,
  CheckCircle, AlertCircle, DollarSign, BarChart2,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type CommSetting = { type: string; rate: number; service: string | null };
type CommHistory = { month: string; amount: number; bonus: number; total: number; paid: boolean; svcRevenue: number; prdRevenue: number };
type Appt = { id: string; date: string; time: string; customer: string; customerId: string; service: string; services: number; revenue: number; status: string; duration: number };
type AttRecord = { date: string; checkIn: string | null; checkOut: string | null; status: string; hoursWorked: string | null };

type StaffProfile = {
  id: string; dbId: string; name: string; initials: string;
  phone: string; email: string; designation: string;
  specializations: string[]; salary: number; bio: string;
  rating: number | null;
  joined: string; isActive: boolean;
  commissionRate: number; commissionSettings: CommSetting[];
  thisMonth: { appointments: number; completed: number; revenue: number; clients: number; commission: number; bonus: number };
  lastMonth: { commission: number; paid: boolean } | null;
  commissionHistory: CommHistory[];
  appts: Appt[];
  attendance: AttRecord[];
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  COMPLETED:   { label: "Completed",   cls: "bg-emerald-100 text-emerald-700" },
  CONFIRMED:   { label: "Confirmed",   cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-primary-100 text-primary-600" },
  CANCELLED:   { label: "Cancelled",   cls: "bg-red-100 text-red-600" },
  WAITING:     { label: "Waiting",     cls: "bg-amber-100 text-amber-700" },
  NO_SHOW:     { label: "No Show",     cls: "bg-gray-100 text-gray-500" },
};

const ATT_META: Record<string, { label: string; cls: string }> = {
  PRESENT:    { label: "Present",    cls: "bg-emerald-100 text-emerald-700" },
  ABSENT:     { label: "Absent",     cls: "bg-red-100 text-red-500" },
  LATE:       { label: "Late",       cls: "bg-amber-100 text-amber-600" },
  HALF_DAY:   { label: "Half Day",   cls: "bg-blue-100 text-blue-600" },
  ON_LEAVE:   { label: "On Leave",   cls: "bg-violet-100 text-violet-600" },
  HOLIDAY:    { label: "Holiday",    cls: "bg-gray-100 text-gray-500" },
};

type Tab = "overview" | "appointments" | "performance" | "attendance";

export default function StaffProfile({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [staff,   setStaff]   = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<Tab>("overview");
  const [savingRating, setSavingRating] = useState(false);
  const [hoverRating,  setHoverRating]  = useState<number | null>(null);

  const setRating = async (value: number) => {
    if (!staff || savingRating) return;
    setSavingRating(true);
    try {
      const res = await fetch(`/api/staff/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error ?? "Failed to save rating."); return; }
      setStaff(s => s ? { ...s, rating: json.data.rating } : s);
      toast.success("Rating saved.");
    } catch {
      toast.error("Failed to save rating.");
    } finally {
      setSavingRating(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/staff/${params.id}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setStaff(j.data);
        else setError(j.error || "Staff not found.");
      })
      .catch(() => setError("Could not load profile."))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#B76E79" }} />
      <p className="text-sm text-muted-foreground">Loading staff profile…</p>
    </div>
  );

  if (error || !staff) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-sm text-red-500">{error || "Staff member not found."}</p>
      <button onClick={() => router.push("/staff")} className="btn-outline text-sm py-2 px-4 flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Back to Staff
      </button>
    </div>
  );

  const TABS: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id: "overview",      label: "Overview",     icon: Briefcase },
    { id: "appointments",  label: "Appointments", icon: Calendar },
    { id: "performance",   label: "Performance",  icon: TrendingUp },
    { id: "attendance",    label: "Attendance",   icon: Clock },
  ];

  const incl   = staff.thisMonth.revenue;
  const excl   = Math.round(incl / 1.18);
  const gstAmt = incl - excl;

  return (
    <div className="px-6 space-y-5 pb-10">

      {/* ── Back ── */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.push("/staff")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Staff
        </button>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{staff.name}</span>
      </div>

      {/* ── Hero ── */}
      <div className="card-luxury overflow-hidden">
        <div className="h-20" style={{ background: "linear-gradient(135deg,#1B2A2D,#B76E79,#C4956A)" }} />
        <div className="px-6 pb-5">
          <div className="flex items-end justify-between -mt-8 mb-4">
            <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg,#B76E79,#C4956A)" }}>
              {staff.initials}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => router.push("/attendance")} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Attendance
              </button>
              <button onClick={() => router.push("/commission")} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Commission
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-display font-bold text-foreground">{staff.name}</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                  {staff.designation}
                </span>
                <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                  staff.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                  {staff.isActive ? "Active" : "Inactive"}
                </span>
                <div className="flex items-center gap-0.5" title="Manager-set performance rating">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" disabled={savingRating}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(n)}
                      className="disabled:opacity-50">
                      <Star className={cn("w-3.5 h-3.5 transition-colors",
                        n <= (hoverRating ?? Math.round(staff.rating ?? 0)) ? "text-amber-400 fill-amber-400" : "text-ivory-300"
                      )} />
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">{staff.rating ? staff.rating.toFixed(1) : "Not rated"}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{staff.id} · Joined {staff.joined}</p>
              {staff.specializations.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Specializations: {staff.specializations.join(", ")}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {staff.phone}
                </span>
                {staff.email && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> {staff.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* KPI chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: "This Month",     value: staff.thisMonth.appointments, sub: `${staff.thisMonth.completed} completed`, color: "#B76E79" },
              { label: "Revenue",        value: `Rs.${incl.toLocaleString("en-IN")}`, sub: "Incl. GST",                     color: "#047857" },
              { label: "Clients",        value: staff.thisMonth.clients,       sub: "Unique served",                        color: "#B45309" },
              { label: "Commission",     value: `Rs.${staff.thisMonth.commission.toLocaleString("en-IN")}`, sub: staff.commissionRate > 0 ? `${staff.commissionRate}% rate` : "Fixed salary", color: "#7C3AED" },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-3 border border-ivory-200" style={{ background: `${k.color}08` }}>
                <p className="text-lg font-display font-bold" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[10px] font-semibold text-foreground">{k.label}</p>
                <p className="text-[9px] text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-ivory-100 rounded-2xl border border-ivory-200 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
              tab === t.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Bio */}
          <div className="card-luxury p-5 lg:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">About</p>
            {staff.bio ? (
              <p className="text-sm text-foreground leading-relaxed">{staff.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No bio added yet.</p>
            )}
          </div>

          {/* Pay & Commission */}
          <div className="card-luxury p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-4">Pay & Commission</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-ivory-50 rounded-xl">
                <p className="text-xs font-semibold text-foreground">Monthly Salary</p>
                <p className="text-sm font-bold text-foreground">Rs.{staff.salary.toLocaleString("en-IN")}</p>
              </div>
              {staff.commissionSettings.length > 0 ? (
                staff.commissionSettings.map((cs, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-ivory-50 rounded-xl">
                    <p className="text-xs font-semibold text-foreground">
                      Commission {cs.service ? `on ${cs.service}` : `(${cs.type === "SERVICE" ? "all services" : "all products"})`}
                    </p>
                    <p className="text-sm font-bold" style={{ color: "#B76E79" }}>{cs.rate}%</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground p-3">No commission settings configured.</p>
              )}
            </div>
          </div>

          {/* Revenue this month */}
          <div className="card-luxury p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-4">Revenue — This Month</p>
            {incl > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-ivory-50 rounded-xl">
                  <p className="text-xs font-semibold text-foreground">Total (Incl. GST)</p>
                  <p className="text-sm font-bold text-foreground">Rs.{incl.toLocaleString("en-IN")}</p>
                </div>
                <div className="flex justify-between items-center p-3 bg-ivory-50 rounded-xl">
                  <p className="text-xs font-semibold text-foreground">Taxable (Excl. GST)</p>
                  <p className="text-sm font-bold" style={{ color: "#B76E79" }}>Rs.{excl.toLocaleString("en-IN")}</p>
                </div>
                <div className="flex justify-between items-center p-3 bg-ivory-50 rounded-xl">
                  <p className="text-xs font-semibold text-foreground">GST @ 18%</p>
                  <p className="text-sm font-bold text-amber-600">Rs.{gstAmt.toLocaleString("en-IN")}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <BarChart2 className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No completed appointments yet this month.</p>
              </div>
            )}
          </div>

          {/* Recent appointments preview */}
          <div className="card-luxury p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground">Recent Appointments</p>
              <button onClick={() => setTab("appointments")} className="text-xs text-primary-600 font-medium hover:underline">
                View all {staff.appts.length}
              </button>
            </div>
            <div className="space-y-2">
              {staff.appts.filter(a => a.status === "COMPLETED").slice(0, 4).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-ivory-50 rounded-xl border border-ivory-200">
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.service}</p>
                    <p className="text-xs text-muted-foreground">{a.date} at {a.time} · {a.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">Rs.{a.revenue.toLocaleString("en-IN")}</p>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_META[a.status]?.cls)}>
                      {STATUS_META[a.status]?.label}
                    </span>
                  </div>
                </div>
              ))}
              {staff.appts.filter(a => a.status === "COMPLETED").length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No completed appointments this month.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ APPOINTMENTS ═══════════════════════════════════════════════════════════ */}
      {tab === "appointments" && (
        <div className="card-luxury overflow-hidden">
          <div className="p-5 border-b border-ivory-200">
            <p className="text-sm font-bold text-foreground">Appointments — This Month</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {staff.appts.length} total · {staff.thisMonth.completed} completed
            </p>
          </div>
          {staff.appts.length === 0 ? (
            <div className="p-10 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No appointments this month.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ivory-50 border-b border-ivory-200">
                    {["Date & Time","Customer","Service","Duration","Revenue","Status"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.appts.map((a, i) => (
                    <tr key={a.id} className={cn("border-b border-ivory-100 hover:bg-ivory-50 transition-colors", i % 2 === 0 ? "" : "bg-ivory-50/40")}>
                      <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">
                        <p>{a.date}</p>
                        <p className="text-muted-foreground">{a.time}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">
                        <button onClick={() => router.push(`/customers/${a.customerId}`)}
                          className="hover:text-primary-600 hover:underline text-left">
                          {a.customer}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground">
                        {a.service}{a.services > 1 ? ` +${a.services - 1}` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{a.duration} min</td>
                      <td className="px-4 py-3 text-xs font-bold text-foreground">
                        {a.revenue > 0 ? `Rs.${a.revenue.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_META[a.status]?.cls ?? "bg-gray-100 text-gray-500")}>
                          {STATUS_META[a.status]?.label ?? a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ PERFORMANCE ════════════════════════════════════════════════════════════ */}
      {tab === "performance" && (
        <div className="space-y-4">

          {/* This month summary */}
          <div className="card-luxury p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-4">This Month Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Appointments",  value: staff.thisMonth.appointments, color: "#B76E79" },
                { label: "Revenue",       value: `Rs.${incl.toLocaleString("en-IN")}`, color: "#047857" },
                { label: "Clients",       value: staff.thisMonth.clients, color: "#B45309" },
                { label: "Commission",    value: `Rs.${staff.thisMonth.commission.toLocaleString("en-IN")}`, color: "#7C3AED" },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-3 border border-ivory-200 text-center" style={{ background: `${k.color}08` }}>
                  <p className="text-xl font-display font-bold" style={{ color: k.color }}>{k.value}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground mt-1">{k.label}</p>
                </div>
              ))}
            </div>
            {staff.thisMonth.bonus > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-700">Bonus this month</p>
                <p className="text-sm font-bold text-emerald-700">Rs.{staff.thisMonth.bonus.toLocaleString("en-IN")}</p>
              </div>
            )}
          </div>

          {/* Commission history */}
          <div className="card-luxury p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-4">Commission History</p>
            {staff.commissionHistory.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No commission records yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ivory-50 border-b border-ivory-200">
                      {["Month","Svc Revenue","Commission","Bonus","Total","Status"].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.commissionHistory.map((c, i) => (
                      <tr key={i} className={cn("border-b border-ivory-100", i % 2 === 0 ? "" : "bg-ivory-50/40")}>
                        <td className="px-3 py-3 text-xs font-semibold text-foreground whitespace-nowrap">{c.month}</td>
                        <td className="px-3 py-3 text-xs text-foreground">Rs.{c.svcRevenue.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-xs font-semibold" style={{ color: "#B76E79" }}>Rs.{c.amount.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-xs text-emerald-600">{c.bonus > 0 ? `Rs.${c.bonus.toLocaleString("en-IN")}` : "—"}</td>
                        <td className="px-3 py-3 text-xs font-bold text-foreground">Rs.{c.total.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold",
                            c.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-600")}>
                            {c.paid ? "Paid" : "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ ATTENDANCE ═════════════════════════════════════════════════════════════ */}
      {tab === "attendance" && (
        <div className="card-luxury overflow-hidden">
          <div className="p-5 border-b border-ivory-200">
            <p className="text-sm font-bold text-foreground">Attendance — Recent 30 Days</p>
            <p className="text-xs text-muted-foreground mt-0.5">{staff.attendance.length} records</p>
          </div>
          {staff.attendance.length === 0 ? (
            <div className="p-10 text-center">
              <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No attendance records yet.</p>
              <button onClick={() => router.push("/attendance")} className="btn-outline text-xs mt-3 py-1.5 px-4">
                Mark Attendance
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ivory-50 border-b border-ivory-200">
                    {["Date","Check In","Check Out","Hours","Status"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.attendance.map((att, i) => (
                    <tr key={i} className={cn("border-b border-ivory-100 hover:bg-ivory-50 transition-colors", i % 2 === 0 ? "" : "bg-ivory-50/40")}>
                      <td className="px-4 py-3 text-xs font-medium text-foreground whitespace-nowrap">{att.date}</td>
                      <td className="px-4 py-3 text-xs text-foreground">{att.checkIn ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-foreground">{att.checkOut ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-foreground">{att.hoursWorked ? `${att.hoursWorked}h` : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", ATT_META[att.status]?.cls ?? "bg-gray-100 text-gray-500")}>
                          {ATT_META[att.status]?.label ?? att.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
