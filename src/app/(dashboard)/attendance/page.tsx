"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type DBStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LATE" | "ON_LEAVE";
type UIStatus = DBStatus | "CASUAL_LEAVE" | "WEEKLY_OFF";

interface DayRecord {
  date:      string;
  status:    DBStatus;
  clockIn:   string | null;  // "HH:MM" 24-hour
  clockOut:  string | null;  // "HH:MM" 24-hour
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

interface TimeForm {
  status:   DBStatus;
  notes?:   string;
  checkIn:  string;  // "HH:MM"
  checkOut: string;  // "HH:MM"
}

const STATUS_META: Record<UIStatus, { label: string; short: string; color: string; bg: string }> = {
  PRESENT:      { label: "Regular",      short: "Reg",   color: "#059669", bg: "#D1FAE5" },
  ABSENT:       { label: "Absent",       short: "A",     color: "#DC2626", bg: "#FEE2E2" },
  HALF_DAY:     { label: "Half Day",     short: "H",     color: "#2563EB", bg: "#DBEAFE" },
  LATE:         { label: "Late",         short: "Late",  color: "#D97706", bg: "#FEF3C7" },
  ON_LEAVE:     { label: "On Leave",     short: "Leave", color: "#7C3AED", bg: "#EDE9FE" },
  CASUAL_LEAVE: { label: "Casual Leave", short: "CL",    color: "#DB2777", bg: "#FCE7F3" },
  WEEKLY_OFF:   { label: "Weekly Off",   short: "W/O",   color: "#6B7280", bg: "#F3F4F6" },
};

// Statuses that show Check In / Check Out time inputs
const TIME_STATUSES = new Set<DBStatus>(["PRESENT", "HALF_DAY", "LATE"]);

// Derive the display status (merges DB status + notes)
function uiStatus(rec: DayRecord): UIStatus {
  if (rec.status === "ON_LEAVE" && rec.notes === "CASUAL_LEAVE") return "CASUAL_LEAVE";
  if (rec.status === "ABSENT"   && rec.notes === "WEEKLY_OFF")   return "WEEKLY_OFF";
  return rec.status;
}

// Format "HH:MM" → "10:30 AM" for display
function fmt24(t: string | null): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr);
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${mStr} ${h >= 12 ? "PM" : "AM"}`;
}

interface StatusAction {
  label:    string;
  dbStatus: DBStatus;
  notes?:   string;
  needsTime: boolean;
  cls:      string;
}

const STATUS_ACTIONS: StatusAction[] = [
  { label: "Regular",      dbStatus: "PRESENT",  needsTime: true,  cls: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
  { label: "Half Day",     dbStatus: "HALF_DAY", needsTime: true,  cls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
  { label: "Late",         dbStatus: "LATE",     needsTime: true,  cls: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  { label: "Casual Leave", dbStatus: "ON_LEAVE", notes: "CASUAL_LEAVE", needsTime: false, cls: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100" },
  { label: "Weekly Off",   dbStatus: "ABSENT",   notes: "WEEKLY_OFF",   needsTime: false, cls: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100" },
  { label: "Absent",       dbStatus: "ABSENT",   needsTime: false, cls: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" },
];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function AttendancePage() {
  const now = new Date();
  const [month,     setMonth]     = useState(now.getMonth() + 1);
  const [year,      setYear]      = useState(now.getFullYear());
  const [staff,     setStaff]     = useState<StaffRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [tab,       setTab]       = useState<"today" | "month">("today");
  // Per-staff open time forms (keyed by dbId)
  const [openTimes, setOpenTimes] = useState<Record<string, TimeForm>>({});

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

  // Post status only (Casual Leave / Weekly Off / Absent)
  const markStatus = async (staffDbId: string, dbStatus: DBStatus, notes?: string) => {
    if (!isAdmin) return;
    const key = `${staffDbId}-${notes ?? dbStatus}`;
    setSaving(key);
    try {
      const res = await fetch("/api/attendance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ staffDbId, date: today, status: dbStatus, notes }),
      });
      const j = await res.json();
      if (j.success) {
        setStaff(prev => prev.map(s => {
          if (s.dbId !== staffDbId) return s;
          return { ...s, records: [...s.records.filter(r => r.date !== today), j.data] };
        }));
        setOpenTimes(prev => { const n = { ...prev }; delete n[staffDbId]; return n; });
      }
    } catch {}
    setSaving(null);
  };

  // Post status + manual times (Regular / Half Day / Late)
  const saveWithTime = async (staffDbId: string, fallbackRec?: DayRecord) => {
    if (!isAdmin) return;
    const tf       = openTimes[staffDbId];
    const status   = tf?.status   ?? fallbackRec?.status   ?? ("PRESENT" as DBStatus);
    const notes    = tf?.notes    ?? fallbackRec?.notes    ?? undefined;
    const checkIn  = tf?.checkIn  ?? fallbackRec?.clockIn  ?? "";
    const checkOut = tf?.checkOut ?? fallbackRec?.clockOut ?? "";

    const key = `${staffDbId}-save`;
    setSaving(key);
    try {
      const res = await fetch("/api/attendance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          staffDbId,
          date:     today,
          status,
          notes,
          clockIn:  checkIn  || undefined,
          clockOut: checkOut || undefined,
        }),
      });
      const j = await res.json();
      if (j.success) {
        setStaff(prev => prev.map(s => {
          if (s.dbId !== staffDbId) return s;
          return { ...s, records: [...s.records.filter(r => r.date !== today), j.data] };
        }));
        setOpenTimes(prev => { const n = { ...prev }; delete n[staffDbId]; return n; });
      }
    } catch {}
    setSaving(null);
  };

  // ── summary counts for today
  const todayCounts = staff.reduce((acc, s) => {
    const rec = s.records.find(r => r.date === today);
    const st  = rec ? uiStatus(rec) : "NOT_MARKED";
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── monthly stats per staff
  const monthStats = (s: StaffRow) => {
    const ui = s.records.map(r => uiStatus(r));
    return {
      regular:     ui.filter(u => u === "PRESENT").length,
      late:        ui.filter(u => u === "LATE").length,
      halfDay:     ui.filter(u => u === "HALF_DAY").length,
      casualLeave: ui.filter(u => u === "CASUAL_LEAVE").length,
      weeklyOff:   ui.filter(u => u === "WEEKLY_OFF").length,
      absent:      ui.filter(u => u === "ABSENT").length,
    };
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDOW    = new Date(year, month - 1, 1).getDay();

  const recordsByDate = (s: StaffRow) =>
    Object.fromEntries(s.records.map(r => [r.date, r]));

  const exportCSV = () => {
    const MONTH_NAMES_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let rows: string[][] = [];
    let filename = "";

    if (tab === "today") {
      filename = `attendance-today-${today}.csv`;
      rows.push(["Staff Name", "Designation", "Status", "Check In", "Check Out", "Work Hours", "Notes"]);
      staff.forEach(s => {
        const rec = s.records.find(r => r.date === today);
        const st  = rec ? STATUS_META[uiStatus(rec)].label : "Not Marked";
        rows.push([
          s.name,
          s.designation,
          st,
          rec?.clockIn  ? fmt24(rec.clockIn)  : "—",
          rec?.clockOut ? fmt24(rec.clockOut) : "—",
          rec?.workHours != null ? `${rec.workHours.toFixed(1)} hrs` : "—",
          rec?.notes && !["CASUAL_LEAVE","WEEKLY_OFF"].includes(rec.notes) ? rec.notes : "",
        ]);
      });
    } else {
      filename = `attendance-${MONTH_NAMES_FULL[month-1]}-${year}.csv`;
      // Header: Staff, Designation, then each day number
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      rows.push(["Staff Name", "Designation", ...days.map(d => String(d)), "Regular", "Late", "Half Day", "Leave", "Absent", "W/Off"]);
      staff.forEach(s => {
        const byDate = recordsByDate(s);
        const dayCells = days.map(d => {
          const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const rec = byDate[dateStr];
          return rec ? STATUS_META[uiStatus(rec)].short : "";
        });
        const stats = monthStats(s);
        rows.push([
          s.name,
          s.designation,
          ...dayCells,
          String(stats.regular),
          String(stats.late),
          String(stats.halfDay),
          String(stats.casualLeave),
          String(stats.absent),
          String(stats.weeklyOff),
        ]);
      });
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

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

        <div className="flex items-center gap-2">
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
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-ivory-300 bg-white hover:bg-ivory-50 transition-colors text-muted-foreground">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
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
                  { label: "Regular",      count: todayCounts.PRESENT      ?? 0, color: "#059669", bg: "#D1FAE5" },
                  { label: "Half Day",     count: todayCounts.HALF_DAY     ?? 0, color: "#2563EB", bg: "#DBEAFE" },
                  { label: "Late",         count: todayCounts.LATE         ?? 0, color: "#D97706", bg: "#FEF3C7" },
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
                      const rec  = s.records.find(r => r.date === today);
                      const ui   = rec ? uiStatus(rec) : null;
                      const meta = ui ? STATUS_META[ui] : null;
                      const tf   = openTimes[s.dbId];

                      // Show time form when: user opened it (tf), or current status already needs time
                      const showTimeForm = tf != null || (rec != null && TIME_STATUSES.has(rec.status));
                      const timeCheckIn  = tf?.checkIn  ?? rec?.clockIn  ?? "";
                      const timeCheckOut = tf?.checkOut ?? rec?.clockOut ?? "";
                      const timeStatus   = tf?.status   ?? rec?.status   ?? ("PRESENT" as DBStatus);
                      const timeNotes    = tf?.notes    ?? rec?.notes    ?? undefined;

                      // Determine which button is active, accounting for open time form
                      const activeUI: UIStatus | null = tf
                        ? (tf.notes === "CASUAL_LEAVE" ? "CASUAL_LEAVE"
                          : tf.notes === "WEEKLY_OFF"  ? "WEEKLY_OFF"
                          : tf.status as UIStatus)
                        : ui;

                      return (
                        <tr key={s.id} className="border-t border-ivory-100 hover:bg-ivory-50 transition-colors align-top">
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
                                <p>In: <span className="font-medium text-foreground">{fmt24(rec.clockIn)}</span></p>
                                {rec.clockOut && <p>Out: <span className="font-medium text-foreground">{fmt24(rec.clockOut)}</span></p>}
                                {rec.workHours != null && <p className="text-[10px]">{rec.workHours.toFixed(1)}h worked</p>}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">—</p>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4">
                              <div className="space-y-2">
                                {/* Status buttons */}
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                  {STATUS_ACTIONS.map(a => {
                                    const isActive =
                                      a.notes === "CASUAL_LEAVE" ? activeUI === "CASUAL_LEAVE"
                                      : a.notes === "WEEKLY_OFF"  ? activeUI === "WEEKLY_OFF"
                                      : a.dbStatus === "ABSENT" && !a.notes ? activeUI === "ABSENT"
                                      : activeUI === (a.dbStatus as UIStatus);
                                    const isBusy = saving === `${s.dbId}-${a.notes ?? a.dbStatus}`;
                                    return (
                                      <button key={a.label}
                                        disabled={!!saving && saving.startsWith(s.dbId)}
                                        onClick={() => {
                                          if (a.needsTime) {
                                            // Open time form — pre-fill from existing record
                                            setOpenTimes(prev => ({
                                              ...prev,
                                              [s.dbId]: {
                                                status:   a.dbStatus,
                                                notes:    a.notes,
                                                checkIn:  prev[s.dbId]?.checkIn  ?? rec?.clockIn  ?? "",
                                                checkOut: prev[s.dbId]?.checkOut ?? rec?.clockOut ?? "",
                                              },
                                            }));
                                          } else {
                                            markStatus(s.dbId, a.dbStatus, a.notes);
                                          }
                                        }}
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

                                {/* Time inputs — visible for Regular / Half Day / Late */}
                                {showTimeForm && (
                                  <div className="flex items-end gap-2 bg-ivory-50 rounded-lg p-2 border border-ivory-200">
                                    <div className="flex-1">
                                      <label className="block text-[10px] text-muted-foreground mb-0.5">Check In</label>
                                      <input
                                        type="time"
                                        value={timeCheckIn}
                                        onChange={e => setOpenTimes(prev => ({
                                          ...prev,
                                          [s.dbId]: {
                                            status:   prev[s.dbId]?.status   ?? timeStatus,
                                            notes:    prev[s.dbId]?.notes    ?? timeNotes,
                                            checkIn:  e.target.value,
                                            checkOut: prev[s.dbId]?.checkOut ?? rec?.clockOut ?? "",
                                          },
                                        }))}
                                        className="text-xs border border-ivory-200 rounded px-1.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-pink-300"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-[10px] text-muted-foreground mb-0.5">Check Out</label>
                                      <input
                                        type="time"
                                        value={timeCheckOut}
                                        onChange={e => setOpenTimes(prev => ({
                                          ...prev,
                                          [s.dbId]: {
                                            status:   prev[s.dbId]?.status  ?? timeStatus,
                                            notes:    prev[s.dbId]?.notes   ?? timeNotes,
                                            checkIn:  prev[s.dbId]?.checkIn ?? rec?.clockIn ?? "",
                                            checkOut: e.target.value,
                                          },
                                        }))}
                                        className="text-xs border border-ivory-200 rounded px-1.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-pink-300"
                                      />
                                    </div>
                                    <button
                                      onClick={() => saveWithTime(s.dbId, rec)}
                                      disabled={saving === `${s.dbId}-save`}
                                      className="text-[11px] px-3 py-1 rounded-lg font-semibold text-white transition-all disabled:opacity-50 whitespace-nowrap"
                                      style={{ background: "#B76E79" }}>
                                      {saving === `${s.dbId}-save` ? "…" : "Save"}
                                    </button>
                                  </div>
                                )}
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
                  const worked   = stats.regular + stats.late + stats.halfDay;
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
                          { label: "Regular", val: stats.regular,     color: "#059669" },
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
                        // Use uiStatus so CASUAL_LEAVE / WEEKLY_OFF show correct colours
                        const ui   = rec ? uiStatus(rec) : null;
                        const meta = ui ? STATUS_META[ui] : null;
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
                      {Object.entries(STATUS_META).filter(([k]) => k !== "ON_LEAVE").map(([k, v]) => (
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
