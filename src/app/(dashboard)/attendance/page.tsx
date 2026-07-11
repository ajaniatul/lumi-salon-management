"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DBStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LATE" | "ON_LEAVE";
type UIStatus = DBStatus | "CASUAL_LEAVE" | "WEEKLY_OFF";

interface DayRecord {
  date:      string;
  status:    DBStatus;
  clockIn:   string | null;
  clockOut:  string | null;
  workHours: number | null;
  notes:     string | null;
}

interface StaffRow {
  id:          string;
  dbId:        string;
  name:        string;
  designation: string;
  records:     DayRecord[];
}

const STATUS_META: Record<UIStatus, { label: string; short: string; color: string; bg: string }> = {
  PRESENT:      { label: "Present",      short: "P",     color: "#059669", bg: "#D1FAE5" },
  ABSENT:       { label: "Absent",       short: "A",     color: "#DC2626", bg: "#FEE2E2" },
  HALF_DAY:     { label: "Half Day",     short: "H",     color: "#2563EB", bg: "#DBEAFE" },
  LATE:         { label: "Late",         short: "Late",  color: "#D97706", bg: "#FEF3C7" },
  ON_LEAVE:     { label: "On Leave",     short: "Leave", color: "#7C3AED", bg: "#EDE9FE" },
  CASUAL_LEAVE: { label: "Casual Leave", short: "CL",    color: "#DB2777", bg: "#FCE7F3" },
  WEEKLY_OFF:   { label: "Weekly Off",   short: "W/O",   color: "#6B7280", bg: "#F3F4F6" },
};

// Derive the display status (merges DB status + notes)
function uiStatus(rec: DayRecord): UIStatus {
  if (rec.status === "ON_LEAVE" && rec.notes === "CASUAL_LEAVE") return "CASUAL_LEAVE";
  if (rec.status === "ABSENT"   && rec.notes === "WEEKLY_OFF")   return "WEEKLY_OFF";
  return rec.status;
}

const MARK_ACTIONS: { label: string; dbStatus: DBStatus; notes?: string; action?: string; cls: string }[] = [
  { label: "Check In",     dbStatus: "PRESENT",  action: "clock_in", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
  { label: "Half Day",     dbStatus: "HALF_DAY",                      cls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
  { label: "Late",         dbStatus: "LATE",                          cls: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  { label: "Casual Leave", dbStatus: "ON_LEAVE",  notes: "CASUAL_LEAVE", cls: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100" },
  { label: "Weekly Off",   dbStatus: "ABSENT",    notes: "WEEKLY_OFF",   cls: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100" },
  { label: "Absent",       dbStatus: "ABSENT",                        cls: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" },
];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function AttendancePage() {
  const now = new Date();
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [staff,   setStaff]   = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab,     setTab]     = useState<"today" | "month">("today");

  const today = todayISO();

  // Load role
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(j => { if (j.success) setIsAdmin(j.role === "ADMIN"); })
      .catch(() => {});
  }, []);

  // Load attendance
  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/attendance?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(j => { if (j.success) setStaff(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const mark = async (staffDbId: string, dbStatus: DBStatus, notes?: string, action?: string) => {
    if (!isAdmin) return;
    const key = `${staffDbId}-${notes ?? action ?? dbStatus}`;
    setSaving(key);
    try {
      const res = await fetch("/api/attendance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ staffDbId, date: today, status: dbStatus, notes, action }),
      });
      const j = await res.json();
      if (j.success) {
        setStaff(prev => prev.map(s => {
          if (s.dbId !== staffDbId) return s;
          const without = s.records.filter(r => r.date !== today);
          return { ...s, records: [...without, j.data] };
        }));
      }
    } catch {}
    setSaving(null);
  };

  // ── summary counts for today (using UI status so CL / W/O show separately)
  const todayCounts = staff.reduce((acc, s) => {
    const rec = s.records.find(r => r.date === today);
    const st  = rec ? uiStatus(rec) : "NOT_MARKED";
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── monthly stats per staff (using uiStatus for CL / W/O distinction)
  const monthStats = (s: StaffRow) => {
    const ui = s.records.map(r => uiStatus(r));
    return {
      present:      ui.filter(u => u === "PRESENT").length,
      late:         ui.filter(u => u === "LATE").length,
      halfDay:      ui.filter(u => u === "HALF_DAY").length,
      casualLeave:  ui.filter(u => u === "CASUAL_LEAVE").length,
      weeklyOff:    ui.filter(u => u === "WEEKLY_OFF").length,
      absent:       ui.filter(u => u === "ABSENT").length,
    };
  };

  // ── days in month for calendar
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDOW    = new Date(year, month - 1, 1).getDay();

  const recordsByDate = (s: StaffRow) =>
    Object.fromEntries(s.records.map(r => [r.date, r]));

  return (
    <div className="px-6 space-y-5">

      {/* ── Month nav + tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        <div className="flex gap-1 p-1 bg-ivory-100 rounded-2xl border border-ivory-200">
          {(["today", "month"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize",
                tab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
              {t === "today" ? "Today's Register" : "Monthly Overview"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#B76E79" }} />
          <p className="text-sm text-muted-foreground">Loading attendance…</p>
        </div>
      ) : (
        <>
          {/* ══ TODAY TAB ════════════════════════════════════════════════════════ */}
          {tab === "today" && (
            <>
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Not Marked",   count: todayCounts.NOT_MARKED   ?? 0, color: "#9CA3AF", bg: "#F3F4F6" },
                  { label: "Present",      count: todayCounts.PRESENT      ?? 0, color: "#059669", bg: "#D1FAE5" },
                  { label: "Late",         count: todayCounts.LATE         ?? 0, color: "#D97706", bg: "#FEF3C7" },
                  { label: "Half Day",     count: todayCounts.HALF_DAY     ?? 0, color: "#2563EB", bg: "#DBEAFE" },
                  { label: "Casual Leave", count: todayCounts.CASUAL_LEAVE ?? 0, color: "#DB2777", bg: "#FCE7F3" },
                  { label: "Weekly Off",   count: todayCounts.WEEKLY_OFF   ?? 0, color: "#6B7280", bg: "#F3F4F6" },
                  { label: "Absent",       count: todayCounts.ABSENT       ?? 0, color: "#DC2626", bg: "#FEE2E2" },
                ].map(p => (
                  <div key={p.label}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold"
                    style={{ color: p.color, background: p.bg, borderColor: p.color + "33" }}>
                    <span className="text-base font-bold">{p.count}</span>
                    <span>{p.label}</span>
                  </div>
                ))}
              </div>

              {/* Staff table */}
              <div className="card-luxury overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ivory-50 border-b border-ivory-200">
                      <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Staff Member</th>
                      <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Clock In / Out</th>
                      {isAdmin && (
                        <th className="py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground text-center">Mark Attendance</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => {
                      const rec     = s.records.find(r => r.date === today);
                      const ui      = rec ? uiStatus(rec) : null;
                      const meta    = ui ? STATUS_META[ui] : null;
                      return (
                        <tr key={s.id} className="border-t border-ivory-100 hover:bg-ivory-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                style={{ background: "linear-gradient(135deg,#B76E79,#C4956A)" }}>
                                {s.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.designation}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {meta ? (
                              <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full border"
                                style={{ color: meta.color, background: meta.bg, borderColor: meta.color + "44" }}>
                                {meta.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Not marked</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {rec?.clockIn ? (
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <p>In: <span className="font-medium text-foreground">{rec.clockIn}</span></p>
                                {rec.workHours && <p className="text-[10px]">{rec.workHours}h worked</p>}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">—</p>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1.5 justify-center">
                                {MARK_ACTIONS.map(a => {
                                  const key     = `${s.dbId}-${a.notes ?? a.action ?? a.dbStatus}`;
                                  const isBusy  = saving === key;
                                  const isActive = ui === (a.notes === "CASUAL_LEAVE" ? "CASUAL_LEAVE"
                                                        : a.notes === "WEEKLY_OFF"    ? "WEEKLY_OFF"
                                                        : a.action === "clock_in"     ? "PRESENT"
                                                        : a.dbStatus);
                                  return (
                                    <button key={a.label} disabled={isBusy}
                                      onClick={() => mark(s.dbId, a.dbStatus, a.notes, a.action)}
                                      className={cn(
                                        "text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all disabled:opacity-50",
                                        a.cls,
                                        isActive && "ring-2 ring-offset-1 ring-current font-bold"
                                      )}>
                                      {isBusy ? "…" : a.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ══ MONTHLY OVERVIEW TAB ════════════════════════════════════════════ */}
          {tab === "month" && (
            <div className="space-y-4">
              {/* Per-staff summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {staff.map(s => {
                  const stats    = monthStats(s);
                  const worked   = stats.present + stats.late + stats.halfDay;
                  const workDays = daysInMonth - stats.weeklyOff;
                  const pct      = Math.round((worked / Math.max(workDays, 1)) * 100);
                  return (
                    <div key={s.id} className="card-luxury p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#B76E79,#C4956A)" }}>
                          {s.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.designation}</p>
                        </div>
                        <span className={cn("text-xs font-bold",
                          pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-amber-500" : "text-red-500")}>
                          {pct}%
                        </span>
                      </div>
                      <div className="grid grid-cols-6 gap-1 text-center">
                        {[
                          { label: "Present", val: stats.present,     color: "#059669" },
                          { label: "Late",    val: stats.late,        color: "#D97706" },
                          { label: "Half",    val: stats.halfDay,     color: "#2563EB" },
                          { label: "CL",      val: stats.casualLeave, color: "#DB2777" },
                          { label: "W/Off",   val: stats.weeklyOff,   color: "#6B7280" },
                          { label: "Absent",  val: stats.absent,      color: "#DC2626" },
                        ].map(st => (
                          <div key={st.label}>
                            <p className="text-sm font-bold" style={{ color: st.color }}>{st.val}</p>
                            <p className="text-[9px] text-muted-foreground">{st.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calendar grid per staff */}
              {staff.map(s => {
                const byDate = recordsByDate(s);
                return (
                  <div key={s.id} className="card-luxury p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#B76E79,#C4956A)" }}>
                        {s.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                      </div>
                      <p className="text-sm font-bold text-foreground">{s.name}</p>
                      <span className="text-xs text-muted-foreground">{s.designation}</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {DAY_LABELS.map(d => (
                        <p key={d} className="text-center text-[9px] font-semibold text-muted-foreground pb-1">{d}</p>
                      ))}
                      {Array.from({ length: firstDOW }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const d    = i + 1;
                        const date = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                        const rec  = byDate[date];
                        const meta = rec ? STATUS_META[rec.status] : null;
                        const isToday = date === today;
                        return (
                          <div key={date}
                            className={cn("aspect-square rounded-lg flex flex-col items-center justify-center", isToday && "ring-2 ring-primary-400")}
                            style={{ background: meta?.bg ?? "#F9F5F5" }}>
                            <p className="text-[10px] font-bold" style={{ color: meta?.color ?? "#C4A0A8" }}>{d}</p>
                            {meta && <p className="text-[8px] font-semibold leading-none mt-0.5" style={{ color: meta.color }}>{meta.short}</p>}
                            {!meta && <p className="text-[8px] text-muted-foreground leading-none mt-0.5">—</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-ivory-200">
                      {Object.entries(STATUS_META).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-sm" style={{ background: v.bg, border: `1px solid ${v.color}44` }} />
                          <p className="text-[10px] text-muted-foreground">{v.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
