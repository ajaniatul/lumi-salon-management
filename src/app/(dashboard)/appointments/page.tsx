"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { InvoiceA4, InvoiceData, generateInvoiceHTML } from "@/components/InvoiceA4";
import { ChevronLeft, ChevronRight, X, UserPlus, Users, Receipt, Banknote, CreditCard, Smartphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";
import toast from "react-hot-toast";

// ─── Constants ───────────────────────────────────────────────────────────────
const SLOT_H     = 17;          // px per 5-min slot  (17 × 12 = 204px/hour)
const SLOT_MINS  = 5;

function parseHour(timeStr: string, defaultHour: number): number {
  if (!timeStr) return defaultHour;
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)?$/i);
  if (!match) return defaultHour;
  let hour = parseInt(match[1], 10);
  const ampm = match[3];
  if (ampm) {
    if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
    if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
  }
  return hour;
}
function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"short", year:"numeric" });
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ─── Gridline helpers ─────────────────────────────────────────────────────────
// With 5-min slots: hour = every 12, half-hour = every 6, quarter = every 3
function borderForSlot(i: number) {
  if (i % 12 === 0) return "1.5px solid #B8949C";   // hour
  if (i % 6  === 0) return "1px solid #DDD0D2";      // half-hour
  if (i % 3  === 0) return "1px solid #EDE5E7";      // 15-min
  return "0.5px solid #F5EEEF";                       // 5-min
}

// ─── Static config ──────────────────────────────────────────────────────────
// Column colours for staff loaded from the database (cycled by index)
const STAFF_PALETTE = [
  { color:"#B76E79", grad:"linear-gradient(135deg,#B76E79,#C4956A)" },
  { color:"#7C3AED", grad:"linear-gradient(135deg,#7C3AED,#A78BFA)" },
  { color:"#0369A1", grad:"linear-gradient(135deg,#0369A1,#38BDF8)" },
  { color:"#047857", grad:"linear-gradient(135deg,#047857,#34D399)" },
  { color:"#B45309", grad:"linear-gradient(135deg,#B45309,#FCD34D)" },
  { color:"#BE185D", grad:"linear-gradient(135deg,#BE185D,#F472B6)" },
];

type StaffCol = { id: string; name: string; role: string; color: string; grad: string };
type SvcOpt   = { id: string; name: string; price: number; duration: number };
type Customer = { id: string; name: string; phone: string; email: string; visits: number; tier: string };

const TIER_CHIP: Record<string,string> = {
  SILVER:"bg-gray-100 text-gray-500 border-gray-200",
  GOLD:"bg-amber-100 text-amber-600 border-amber-200",
  PLATINUM:"bg-primary-100 text-primary-600 border-primary-200",
};

type Status = "CONFIRMED"|"IN_PROGRESS"|"COMPLETED"|"WAITING"|"CANCELLED";
type Appt = {
  id:string; staffId:string; customer:string; phone:string; customerCode?:string|null;
  service:string; serviceId?:string|null; unitPrice?:number|null; gstRate?:number;
  invoiceNumber?:string|null; invoiceTotal?:number|null;
  startSlot:number; durationSlots:number; status:Status; notes?:string
};

const STATUS_META: Record<Status,{label:string;badge:string}> = {
  CONFIRMED:   { label:"Confirmed",   badge:"bg-blue-100 text-blue-700 border border-blue-200" },
  IN_PROGRESS: { label:"In Progress", badge:"bg-emerald-100 text-emerald-700 border border-emerald-200" },
  COMPLETED:   { label:"Completed",   badge:"bg-gray-100 text-gray-500 border border-gray-200" },
  WAITING:     { label:"Waiting",     badge:"bg-amber-100 text-amber-700 border border-amber-200" },
  CANCELLED:   { label:"Cancelled",   badge:"bg-red-100 text-red-500 border border-red-200" },
};

// Same hues as STATUS_META's badges — used for the appointment block fill so status
// is readable at a glance on the calendar; the block's border carries the stylist color.
const STATUS_COLOR: Record<Status,string> = {
  CONFIRMED:   "#3B82F6",
  IN_PROGRESS: "#10B981",
  COMPLETED:   "#9CA3AF",
  WAITING:     "#F59E0B",
  CANCELLED:   "#EF4444",
};

const defaultForm = {
  customerMode: "existing" as "existing"|"new",
  customerId: "",
  customerSearch: "",
  customer: "",
  phone: "",
  email: "",
  saveToDb: true,
  service: "",
  notes: "",
  fromSlot: 0,
  toSlot: 1,
};

export default function AppointmentsPage() {
  const { setAction } = useHeaderAction();
  const [appts,       setAppts]       = useState<Appt[]>([]);
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [STAFF,       setSTAFF]       = useState<StaffCol[]>([]);
  const [services,    setServices]    = useState<SvcOpt[]>([]);
  const [loadingDay,  setLoadingDay]  = useState(true);
  const [drag,        setDrag]        = useState<{staffId:string;start:number;end:number}|null>(null);
  const [bookModal,   setBookModal]   = useState<{staffId:string;startSlot:number;endSlot:number}|null>(null);
  const [detailAppt,  setDetailAppt]  = useState<Appt|null>(null);
  const [form,        setForm]        = useState(defaultForm);
  const [selectedDate,setSelectedDate]= useState(() => new Date());
  const [billingAppt,  setBillingAppt]  = useState<Appt | null>(null);
  const [settings,     setSettings]     = useState<any>(null);
  const [movingApptId, setMovingApptId] = useState<string | null>(null);
  const [moveTarget,   setMoveTarget]   = useState<{staffId:string; slot:number} | null>(null);

  // Derived scheduler hours configuration from settings
  const dayStart = settings?.openingTime ? parseHour(settings.openingTime, 10) : 10;
  const dayEnd = settings?.closingTime ? parseHour(settings.closingTime, 19) : 19;
  const totalSlots = (dayEnd - dayStart) * (60 / SLOT_MINS);

  const toSlot = useCallback((hour: number, min: number) => {
    return (hour - dayStart) * (60 / SLOT_MINS) + min / SLOT_MINS;
  }, [dayStart]);

  const slotToTime = useCallback((slot: number) => {
    const total = dayStart * 60 + slot * SLOT_MINS;
    const h = Math.floor(total / 60);
    const m = total % 60;
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }, [dayStart]);

  const allSlots = Array.from({ length: totalSlots + 1 }, (_, i) => ({ slot: i, label: slotToTime(i) }));

  const [payMethod,    setPayMethod]    = useState<"CASH"|"CARD"|"UPI">("UPI");
  const [gstRate,      setGstRate]      = useState<5|18>(18);
  const [currentInvNum,setCurrentInvNum]= useState("");
  const [cardDetails,  setCardDetails]  = useState({ number:"", expiry:"", cvv:"", name:"" });
  const [payProcessing,setPayProcessing]= useState(false);
  const [payDone,      setPayDone]      = useState(false);
  const [showA4,        setShowA4]        = useState(false);
  const [discountType, setDiscountType] = useState<"PCT"|"FLAT">("PCT");
  const [discountVal,  setDiscountVal]  = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const dragging     = useRef(false);
  const dragStaffRef = useRef<string|null>(null);
  // dragRef mirrors drag state so the mouseup handler can read it without
  // needing drag in its dependency array (avoids listener churn on every cell enter)
  const dragRef      = useRef<{staffId:string;start:number;end:number}|null>(null);
  const curKey       = dateKey(selectedDate);

  // ── Load reference data (staff columns, services, customers) once ──
  const loadCustomers = () =>
    fetch("/api/customers").then(r => r.json()).then(j => {
      if (j.success) setCustomers(j.data.map((c: any) => ({
        id: c.id, name: c.name, phone: c.phone, email: c.email, visits: c.visits,
        tier: c.membership ? String(c.membership).toUpperCase() : "SILVER",
      })));
    }).catch(() => {});

  useEffect(() => {
    (async () => {
      try {
        const [st, sv, set] = await Promise.all([
          fetch("/api/staff").then(r => r.json()),
          fetch("/api/services").then(r => r.json()),
          fetch("/api/settings").then(r => r.json()),
        ]);
        if (st.success) setSTAFF(st.data.map((s: any, i: number) => ({
          id: s.dbId, name: s.name, role: s.designation,
          color: STAFF_PALETTE[i % STAFF_PALETTE.length].color,
          grad:  STAFF_PALETTE[i % STAFF_PALETTE.length].grad,
        })));
        if (sv.success) setServices(sv.data.map((s: any) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })));
        if (set.success) setSettings(set.data);
      } catch {}
      loadCustomers();
    })();
  }, []);

  // ── Load appointments for the selected day ──
  useEffect(() => {
    let active = true;
    setLoadingDay(true);
    fetch(`/api/appointments?date=${curKey}`)
      .then(r => r.json())
      .then(j => { if (active && j.success) setAppts(j.data); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingDay(false); });
    return () => { active = false; };
  }, [curKey]);

  // ── Surface "New Booking" in the top header bar ──
  useEffect(() => {
    if (STAFF.length === 0) { setAction(null); return; }
    setAction({
      label: "New Booking",
      onClick: () => {
        setBookModal({ staffId: STAFF[0].id, startSlot: toSlot(dayStart, 0), endSlot: toSlot(dayStart + 1, 0) });
        setForm({ ...defaultForm, service: services[0]?.id ?? "", fromSlot: toSlot(dayStart, 0), toSlot: toSlot(dayStart + 1, 0) });
      },
    });
    return () => setAction(null);
  }, [STAFF, services, setAction, toSlot, dayStart]);

  // ── global mouseup for drag (registered once, reads from refs) ──────────────
  useEffect(() => {
    const onUp = () => {
      if (dragging.current && dragRef.current) {
        const d = dragRef.current;
        const s = Math.min(d.start, d.end);
        const e = Math.max(d.start, d.end) + 1;
        if (e - s >= 1) {
          setBookModal({ staffId: d.staffId, startSlot: s, endSlot: e });
          setForm({ ...defaultForm, fromSlot: s, toSlot: e });
        }
      }
      dragging.current  = false;
      dragStaffRef.current = null;
      dragRef.current   = null;
      setDrag(null);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []); // empty — all state accessed via refs

  const onCellDown  = (staffId: string, slot: number) => {
    if (dayAppts.some(a => a.staffId === staffId && slot >= a.startSlot && slot < a.startSlot + a.durationSlots)) return;
    dragging.current     = true;
    dragStaffRef.current = staffId;
    dragRef.current      = { staffId, start: slot, end: slot };
    setDrag({ staffId, start: slot, end: slot });
  };
  const onCellEnter = (staffId: string, slot: number) => {
    if (dragging.current && dragStaffRef.current === staffId) {
      dragRef.current = { staffId, start: dragRef.current!.start, end: slot };
      setDrag(prev => prev ? { ...prev, end: slot } : null);
    }
  };

  const changeStatus = async (id: string, status: Status) => {
    setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setDetailAppt(prev => prev?.id === id ? { ...prev, status } : prev);
    try {
      await fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    } catch {}
  };

  // Move an existing appointment to a different stylist column and/or time slot (drag-and-drop reschedule).
  const moveAppt = async (id: string, staffId: string, startSlot: number) => {
    const appt = appts.find(a => a.id === id);
    if (!appt) return;
    const endSlot = startSlot + appt.durationSlots;
    const clash = appts.some(a =>
      a.id !== id && a.staffId === staffId && a.status !== "CANCELLED" &&
      startSlot < a.startSlot + a.durationSlots && endSlot > a.startSlot
    );
    if (clash) { toast.error("That stylist already has an appointment at this time."); return; }

    const prevAppts = appts;
    setAppts(prev => prev.map(a => a.id === id ? { ...a, staffId, startSlot } : a));
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, startSlot, endSlot }),
      });
      const j = await res.json();
      if (!j.success) { setAppts(prevAppts); toast.error(j.error || "Could not reschedule appointment."); return; }
      toast.success("Appointment rescheduled");
    } catch {
      setAppts(prevAppts);
      toast.error("Network error. Please try again.");
    }
  };
  const deleteAppt = async (id: string) => {
    setDetailAppt(null);
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { toast.error(j.error || "Could not delete appointment."); return; }
      setAppts(prev => prev.filter(a => a.id !== id));
      toast.success(j.data?.hadInvoice ? "Appointment deleted and its invoice/payment reversed" : "Appointment cancelled");
    } catch {
      toast.error("Network error. Please try again.");
    }
  };

  const servicePrice = (name: string) => services.find(s => s.name === name)?.price ?? 1000;

  const dayAppts = appts;
  const counts = {
    total:      dayAppts.length,
    inProgress: dayAppts.filter(a => a.status === "IN_PROGRESS").length,
    confirmed:  dayAppts.filter(a => a.status === "CONFIRMED").length,
    completed:  dayAppts.filter(a => a.status === "COMPLETED").length,
    waiting:    dayAppts.filter(a => a.status === "WAITING").length,
  };

  const prevDay = () => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()-1); return n; });
  const nextDay = () => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()+1); return n; });

  const selectedCustomer = customers.find(c => c.id === form.customerId);

  // ─── Booking modal validation ─────────────────────────────────────────────
  const timeValid = form.toSlot > form.fromSlot;
  const dur = (form.toSlot - form.fromSlot) * SLOT_MINS;
  const customerReady = form.customerMode === "existing"
    ? !!form.customerId
    : !!(form.customer.trim() && form.phone.trim());
  const canSubmit = timeValid && customerReady && !!form.service;
  const [booking, setBooking] = useState(false);

  const submitBooking = async () => {
    if (!bookModal || !canSubmit || booking) return;
    setBooking(true);
    const body: any = {
      date: curKey,
      staffId: bookModal.staffId,
      startSlot: form.fromSlot,
      endSlot: form.toSlot,
      serviceId: form.service,
      notes: form.notes,
    };
    if (form.customerMode === "existing" && selectedCustomer) {
      body.customerCode = selectedCustomer.id;
    } else {
      body.newCustomer = { name: form.customer.trim(), phone: form.phone.trim(), email: form.email.trim() };
    }
    try {
      const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok || !j.success) { toast.error(j.error || "Could not book appointment."); setBooking(false); return; }
      setAppts(a => [...a, j.data]);
      if (form.customerMode === "new") loadCustomers(); // pick up the newly created customer for future searches
      setBookModal(null);
      setForm(defaultForm);
      toast.success("Appointment booked");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full" style={{ userSelect:"none" }}>

      {/* ── Date navigation ── */}
      <div className="flex items-center gap-2">
        <button onClick={prevDay} className="p-1.5 rounded-lg border border-ivory-300 hover:bg-ivory-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground px-2 whitespace-nowrap">{formatDate(selectedDate)}</span>
        <button onClick={nextDay} className="p-1.5 rounded-lg border border-ivory-300 hover:bg-ivory-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        {loadingDay && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-1" />}
      </div>

      {/* ── Compact summary + legend (single slim row, keeps the grid tall) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label:"Total",       value:counts.total,      color:"#B76E79" },
          { label:"In Progress", value:counts.inProgress, color:"#10B981" },
          { label:"Confirmed",   value:counts.confirmed,  color:"#3B82F6" },
          { label:"Waiting",     value:counts.waiting,    color:"#F59E0B" },
          { label:"Completed",   value:counts.completed,  color:"#9CA3AF" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-ivory-200">
            <span className="text-sm font-display font-bold" style={{ color:s.color }}>{s.value}</span>
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-auto hidden md:block">Drag on empty space to book · click an appointment to manage</span>
      </div>

      {/* ── Scheduler grid ── */}
      <div
        className="card-luxury overflow-auto"
        style={{ minHeight:0, flex:"1 1 0" }}
        onMouseLeave={() => { if (dragging.current) { dragging.current = false; dragStaffRef.current = null; dragRef.current = null; setDrag(null); } }}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-30 flex bg-white">
          <div className="w-16 flex-shrink-0 bg-ivory-50" style={{ borderRight:"2px solid #C5A8AE" }} />
          {STAFF.map(s => (
            <div key={s.id} className="flex-1 min-w-[155px] px-3 py-3 bg-ivory-50" style={{ borderRight:"1px solid #C5A8AE" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm" style={{ background:s.grad }}>
                  {s.name.split(" ").map((n:string)=>n[0]).join("")}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground leading-tight truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.role}</p>
                  <p className="text-[10px] font-medium" style={{ color:s.color }}>
                    {dayAppts.filter(a=>a.staffId===s.id&&a.status!=="COMPLETED"&&a.status!=="CANCELLED").length} active
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex">
          {/* Time gutter */}
          <div className="w-16 flex-shrink-0 sticky left-0 z-10 bg-white" style={{ borderRight:"2px solid #C5A8AE" }}>
            {Array.from({ length: totalSlots }, (_, i) => {
              const isHour = i % 12 === 0;
              const isHalf = i % 6  === 0 && !isHour;
              return (
                <div key={i}
                  className="flex items-start justify-end pr-2 pt-0.5"
                  style={{ height:SLOT_H, borderBottom:borderForSlot(i) }}
                >
                  {isHour && <span className="text-[10px] font-semibold text-muted-foreground leading-none">{slotToTime(i)}</span>}
                  {isHalf && <span className="text-[9px] leading-none" style={{ color:"#B8949C" }}>{slotToTime(i).replace(" AM","").replace(" PM","")}</span>}
                </div>
              );
            })}
          </div>

          {/* Staff columns */}
          {STAFF.map(s => {
            const colAppts = dayAppts.filter(a => a.staffId === s.id);
            const dragMin  = drag?.staffId === s.id ? Math.min(drag.start, drag.end) : null;
            const dragMax  = drag?.staffId === s.id ? Math.max(drag.start, drag.end) : null;
            const movingAppt = movingApptId ? appts.find(a => a.id === movingApptId) : null;
            const moveMin = movingAppt && moveTarget?.staffId === s.id ? moveTarget.slot : null;
            const moveMax = movingAppt && moveTarget?.staffId === s.id ? moveTarget.slot + movingAppt.durationSlots - 1 : null;
            return (
              <div key={s.id} className="flex-1 min-w-[155px] relative" style={{ borderRight:"1px solid #C5A8AE" }}>
                {/* Slot cells */}
                {Array.from({ length: totalSlots }, (_, i) => {
                  const occupied = colAppts.some(a => i >= a.startSlot && i < a.startSlot + a.durationSlots);
                  const inDrag   = dragMin !== null && dragMax !== null && i >= dragMin && i <= dragMax;
                  const inMoveTarget = moveMin !== null && moveMax !== null && i >= moveMin && i <= moveMax;
                  return (
                    <div key={i}
                      className={cn("transition-colors", inMoveTarget ? "bg-emerald-100" : inDrag ? "bg-primary-100" : occupied ? "" : "hover:bg-rose-50")}
                      style={{
                        height: SLOT_H,
                        cursor: occupied ? "default" : "crosshair",
                        borderBottom: borderForSlot(i),
                      }}
                      onMouseDown={e => { e.preventDefault(); if (!occupied) onCellDown(s.id, i); }}
                      onMouseEnter={() => onCellEnter(s.id, i)}
                      onDragOver={e => { if (movingApptId) { e.preventDefault(); setMoveTarget({ staffId: s.id, slot: i }); } }}
                      onDrop={e => {
                        e.preventDefault();
                        if (movingApptId) moveAppt(movingApptId, s.id, i);
                        setMovingApptId(null);
                        setMoveTarget(null);
                      }}
                    />
                  );
                })}

                {/* Drag preview */}
                {dragMin !== null && dragMax !== null && (
                  <div className="absolute inset-x-1 pointer-events-none rounded-lg z-10"
                    style={{
                      top:    dragMin * SLOT_H + 2,
                      height: (dragMax - dragMin + 1) * SLOT_H - 4,
                      background: `${s.color}18`,
                      border: `2px dashed ${s.color}`,
                    }}
                  >
                    <p className="text-[10px] font-bold p-1.5" style={{ color:s.color }}>
                      {slotToTime(dragMin)} → {slotToTime(dragMax + 1)}
                      <br />
                      <span className="font-normal opacity-70">{(dragMax - dragMin + 1) * SLOT_MINS} min</span>
                    </p>
                  </div>
                )}

                {/* Appointment blocks */}
                {colAppts.map(appt => {
                  const isCompleted  = appt.status === "COMPLETED";
                  const isCancelled  = appt.status === "CANCELLED";
                  const isInProgress = appt.status === "IN_PROGRESS";
                  const isWaiting    = appt.status === "WAITING";
                  const isMovable    = !isCompleted && !isCancelled;
                  return (
                    <div key={appt.id}
                      draggable={isMovable}
                      onDragStart={e => { if (isMovable) { setMovingApptId(appt.id); e.dataTransfer.effectAllowed = "move"; } }}
                      onDragEnd={() => { setMovingApptId(null); setMoveTarget(null); }}
                      className={cn(
                        "absolute inset-x-1 rounded-lg overflow-hidden z-20 cursor-pointer transition-all duration-150",
                        "hover:inset-x-0 hover:z-30 hover:shadow-xl",
                        isMovable ? "active:cursor-grabbing" : "",
                        isCancelled || isCompleted ? "opacity-55" : "",
                        movingApptId === appt.id ? "opacity-30" : ""
                      )}
                      style={{
                        top:    appt.startSlot * SLOT_H + 2,
                        height: appt.durationSlots * SLOT_H - 4,
                        background: `${STATUS_COLOR[appt.status]}55`,
                        border: `2px solid ${s.color}`,
                      }}
                      onClick={() => setDetailAppt(appt)}
                    >
                      <div className="p-1.5 h-full flex flex-col gap-0.5 overflow-hidden">
                        <p className="text-[11px] font-bold leading-tight truncate" style={{ color:isCompleted?"#7A6870":s.color }}>
                          {appt.customer}
                        </p>
                        {appt.durationSlots >= 6 && (
                          <p className="text-[10px] text-foreground opacity-75 truncate leading-tight">{appt.service}</p>
                        )}
                        {appt.durationSlots >= 9 && (
                          <p className="text-[9px] text-muted-foreground leading-tight">
                            {slotToTime(appt.startSlot)} – {slotToTime(appt.startSlot + appt.durationSlots)}
                          </p>
                        )}
                        {appt.durationSlots >= 9 && appt.notes && (
                          <p className="text-[9px] text-amber-500 font-medium">📌 Has notes</p>
                        )}
                        {appt.durationSlots >= 12 && (
                          <div className="mt-auto">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{
                                background: isInProgress?"#D1FAE5":isWaiting?"#FEF3C7":isCompleted?"#F3F4F6":"#DBEAFE",
                                color:      isInProgress?"#065F46":isWaiting?"#92400E":isCompleted?"#6B7280":"#1E40AF",
                              }}>
                              {STATUS_META[appt.status].label}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BOOKING MODAL ── */}
      {bookModal && (() => {
        const s = STAFF.find(st => st.id === bookModal.staffId)!;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setBookModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden max-h-[92vh] flex flex-col">

              {/* Header */}
              <div className="p-5 border-b border-ivory-200 flex-shrink-0" style={{ background:"linear-gradient(135deg,#2D1B1F,#1A0F12)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-display font-bold text-base">New Appointment</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold" style={{ background:s.grad }}>
                        {s.name.split(" ").map((n:string)=>n[0]).join("")}
                      </div>
                      <p className="text-xs" style={{ color:"#C4A0A8" }}>
                        {s.name} · {timeValid ? `${slotToTime(form.fromSlot)} – ${slotToTime(form.toSlot)}` : "Select time below"}
                        {timeValid && <span className="ml-1 font-semibold" style={{ color:"#E8C5CB" }}>({dur} min)</span>}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setBookModal(null)} className="p-1.5 rounded-lg hover:bg-white/10">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">

                {/* ── Customer section ── */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-2 block">
                    Customer <span className="text-red-400">*</span>
                  </label>
                  {/* Mode toggle */}
                  <div className="flex rounded-xl border border-ivory-300 overflow-hidden mb-3">
                    <button
                      className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors",
                        form.customerMode === "existing" ? "text-white" : "text-muted-foreground hover:bg-ivory-100"
                      )}
                      style={form.customerMode === "existing" ? { background:"#B76E79" } : {}}
                      onClick={() => setForm(p => ({ ...p, customerMode:"existing", customerId:"", customerSearch:"" }))}
                    >
                      <Users className="w-3.5 h-3.5" /> Existing Customer
                    </button>
                    <button
                      className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors border-l border-ivory-300",
                        form.customerMode === "new" ? "text-white" : "text-muted-foreground hover:bg-ivory-100"
                      )}
                      style={form.customerMode === "new" ? { background:"#B76E79" } : {}}
                      onClick={() => setForm(p => ({ ...p, customerMode:"new", customerId:"" }))}
                    >
                      <UserPlus className="w-3.5 h-3.5" /> New Customer
                    </button>
                  </div>

                  {form.customerMode === "existing" ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          className="input-luxury w-full text-sm"
                          placeholder="Type a name or phone to search..."
                          value={form.customerSearch}
                          onChange={e => setForm(p => ({ ...p, customerSearch: e.target.value, customerId: "" }))}
                          autoFocus
                        />
                        {form.customerSearch.trim() && (() => {
                          const matches = customers.filter(c =>
                            c.name.toLowerCase().includes(form.customerSearch.toLowerCase()) ||
                            c.phone.includes(form.customerSearch)
                          );
                          return (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden"
                              style={{ boxShadow:"0 8px 30px rgba(183,110,121,0.18)", border:"1px solid #DFACB2", background:"#fff" }}>
                              {matches.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-center" style={{ color:"#9A5D67" }}>
                                  No customers found
                                </div>
                              ) : matches.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => setForm(p => ({ ...p, customerId: c.id, customerSearch: c.name }))}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                                  style={{
                                    background: form.customerId === c.id ? "#FCF5F6" : "transparent",
                                    borderBottom: "1px solid #F7E8EA",
                                  }}
                                  onMouseEnter={e => { if (form.customerId !== c.id) (e.currentTarget as HTMLElement).style.background = "#FBF0F2"; }}
                                  onMouseLeave={e => { if (form.customerId !== c.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                >
                                  {/* Avatar */}
                                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                                    style={{ background:"linear-gradient(135deg,#B76E79,#C4956A)" }}>
                                    {c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </div>
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color:"#1A1A2E" }}>{c.name}</p>
                                    <p className="text-[10px]" style={{ color:"#6B7280" }}>{c.phone} · {c.visits} visits</p>
                                  </div>
                                  {/* Tier badge */}
                                  <span className={cn("badge text-[9px] border flex-shrink-0", TIER_CHIP[c.tier])}>{c.tier}</span>
                                  {/* Checkmark */}
                                  {form.customerId === c.id && (
                                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px]"
                                      style={{ background:"#B76E79" }}>✓</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      {selectedCustomer && (
                        <p className="text-[10px] font-medium" style={{ color:"#10B981" }}>
                          ✓ {selectedCustomer.name} · {selectedCustomer.phone} · {selectedCustomer.visits} visits · {selectedCustomer.tier}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1 block">Full Name <span className="text-red-400">*</span></label>
                          <input className="input-luxury w-full text-sm" placeholder="e.g. Priya Sharma"
                            value={form.customer} onChange={e => setForm(p => ({ ...p, customer:e.target.value }))} autoFocus />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1 block">Phone</label>
                          <input className="input-luxury w-full text-sm" placeholder="10-digit"
                            value={form.phone} onChange={e => setForm(p => ({ ...p, phone:e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Email (optional)</label>
                        <input className="input-luxury w-full text-sm" placeholder="email@example.com"
                          value={form.email} onChange={e => setForm(p => ({ ...p, email:e.target.value }))} />
                      </div>
                      {/* Save to DB toggle */}
                      <button
                        className={cn(
                          "w-full flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all",
                          form.saveToDb ? "bg-emerald-50 border-emerald-200" : "bg-ivory-50 border-ivory-300"
                        )}
                        onClick={() => setForm(p => ({ ...p, saveToDb:!p.saveToDb }))}
                      >
                        <div className={cn("w-8 h-5 rounded-full flex-shrink-0 transition-colors relative", form.saveToDb ? "bg-emerald-500" : "bg-gray-300")}>
                          <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform", form.saveToDb ? "translate-x-3" : "translate-x-0.5")} />
                        </div>
                        <div>
                          <p className={cn("text-xs font-semibold", form.saveToDb?"text-emerald-700":"text-foreground")}>
                            {form.saveToDb ? "Save to customer database" : "Don't save to database"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {form.saveToDb ? "This customer will appear in all future lookups" : "One-time booking — no customer record created"}
                          </p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Time picker ── */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Appointment Time
                    {timeValid && <span className="ml-2 text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{dur} min</span>}
                    {!timeValid && <span className="ml-2 text-[10px] font-normal px-2 py-0.5 rounded-full bg-red-100 text-red-500">End must be after start</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">From</p>
                      <select className="input-luxury w-full text-sm" value={form.fromSlot}
                        onChange={e => { const v = Number(e.target.value); setForm(p => ({ ...p, fromSlot:v, toSlot:p.toSlot<=v?v+1:p.toSlot })); }}>
                        {allSlots.slice(0, totalSlots).map(({slot,label}) => <option key={slot} value={slot}>{label}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">To</p>
                      <select className="input-luxury w-full text-sm" value={form.toSlot}
                        onChange={e => setForm(p => ({ ...p, toSlot:Number(e.target.value) }))}>
                        {allSlots.slice(1).map(({slot,label}) => <option key={slot} value={slot} disabled={slot<=form.fromSlot}>{label}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Pre-filled from drag selection. Adjust freely.</p>
                </div>

                {/* ── Stylist ── */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Stylist</label>
                  <select className="input-luxury w-full text-sm" value={bookModal.staffId}
                    onChange={e => setBookModal(p => p ? { ...p, staffId:e.target.value } : p)}>
                    {STAFF.map(st => <option key={st.id} value={st.id}>{st.name} — {st.role}</option>)}
                  </select>
                </div>

                {/* ── Service ── */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Service <span className="text-red-400">*</span></label>
                  <select className="input-luxury w-full text-sm" value={form.service}
                    onChange={e => setForm(p => ({ ...p, service:e.target.value }))}>
                    <option value="">Select a service...</option>
                    {services.map(sv => <option key={sv.id} value={sv.id}>{sv.name} — Rs.{sv.price.toLocaleString("en-IN")}</option>)}
                  </select>
                </div>

                {/* ── Notes ── */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <textarea className="input-luxury w-full text-sm resize-none" rows={2}
                    placeholder="Allergies, preferences, special instructions..."
                    value={form.notes} onChange={e => setForm(p => ({ ...p, notes:e.target.value }))} />
                </div>
              </div>

              {/* Submit */}
              <div className="p-5 border-t border-ivory-200 flex-shrink-0 space-y-2">
                <button disabled={!canSubmit} onClick={submitBooking}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background:"linear-gradient(135deg,#B76E79,#C4956A)" }}>
                  Book Appointment
                </button>
                <button onClick={() => setBookModal(null)}
                  className="w-full py-2 rounded-xl text-sm text-muted-foreground hover:bg-ivory-100 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* APPOINTMENT DETAIL PANEL */}
      {detailAppt && (() => {
        const s       = STAFF.find(st => st.id === detailAppt.staffId)!;
        const dateStr = selectedDate.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setDetailAppt(null)} />
            <div className="relative bg-white w-full sm:w-80 h-auto sm:h-full shadow-2xl z-10 flex flex-col sm:rounded-none rounded-t-2xl overflow-hidden">
              <div className="p-5 flex-shrink-0" style={{ background:`linear-gradient(135deg,${s.color},${s.color}CC)` }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-display font-bold text-base">Appointment</p>
                    <p className="text-white/70 text-xs mt-0.5">{dateStr}</p>
                  </div>
                  <button onClick={() => setDetailAppt(null)} className="p-1.5 rounded-lg hover:bg-white/20">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                    style={{ background:"rgba(255,255,255,0.25)" }}>
                    {detailAppt.customer.split(" ").map((n)=>n[0]).join("").slice(0,2)}
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">{detailAppt.customer}</p>
                    <p className="text-xs text-white/70">{detailAppt.phone || "No phone saved"}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label:"Service",  value:detailAppt.service },
                    { label:"Stylist",  value:s.name },
                    { label:"Start",    value:slotToTime(detailAppt.startSlot) },
                    { label:"End",      value:slotToTime(detailAppt.startSlot + detailAppt.durationSlots) },
                    { label:"Duration", value:`${detailAppt.durationSlots * SLOT_MINS} min` },
                    { label:"Date",     value:dateStr },
                  ].map(f => (
                    <div key={f.label} className="bg-ivory-50 rounded-xl p-2.5 border border-ivory-200">
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">{f.label}</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5 leading-tight">{f.value}</p>
                    </div>
                  ))}
                </div>
                <span className={cn("badge text-xs", STATUS_META[detailAppt.status].badge)}>
                  {STATUS_META[detailAppt.status].label}
                </span>
                {detailAppt.notes && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Stylist Notes</p>
                    <p className="text-xs text-amber-800 leading-relaxed">{detailAppt.notes}</p>
                  </div>
                )}
                <div className="space-y-2 pt-1">
                  {detailAppt.status === "WAITING" && (
                    <button className="w-full text-sm py-2 rounded-xl font-semibold text-white transition-colors"
                      style={{ background:s.color }} onClick={() => changeStatus(detailAppt.id, "CONFIRMED")}>
                      Assign &amp; Confirm
                    </button>
                  )}
                  {detailAppt.status === "CONFIRMED" && (
                    <button className="w-full text-sm py-2 rounded-xl font-semibold text-white bg-emerald-500"
                      onClick={() => changeStatus(detailAppt.id, "IN_PROGRESS")}>
                      Start Service
                    </button>
                  )}
                  {detailAppt.status === "IN_PROGRESS" && (
                    <button className="w-full text-sm py-2 rounded-xl font-semibold text-white bg-emerald-600 flex items-center justify-center gap-2"
                      onClick={() => {
                        setBillingAppt(detailAppt);
                        setPayMethod("UPI");
                        setGstRate(18);
                        setCurrentInvNum(`INV-2026-${String(Date.now()).slice(-4)}`);
                      }}>
                      <Receipt className="w-4 h-4" /> Complete &amp; Bill
                    </button>
                  )}
                  {(detailAppt.status === "CONFIRMED" || detailAppt.status === "WAITING") && (
                    <button className="w-full text-sm py-2 rounded-xl font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      onClick={() => deleteAppt(detailAppt.id)}>
                      Cancel Appointment
                    </button>
                  )}
                  {detailAppt.status === "COMPLETED" && (
                    <button className="w-full text-sm py-2 rounded-xl font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        const warning = detailAppt.invoiceNumber
                          ? `This appointment was billed as ${detailAppt.invoiceNumber} (₹${detailAppt.invoiceTotal?.toLocaleString("en-IN")}). Deleting it will also delete that invoice and reverse the payment, spend, and loyalty points it added. Continue?`
                          : "Delete this completed appointment? This cannot be undone.";
                        if (window.confirm(warning)) deleteAppt(detailAppt.id);
                      }}>
                      Delete Appointment
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BILLING MODAL */}
      {billingAppt && (() => {
        const s        = STAFF.find(st => st.id === billingAppt.staffId)!;
        const base         = billingAppt.unitPrice ?? servicePrice(billingAppt.service);
        const dv           = Number(discountVal) || 0;
        const discountAmt  = discountType === "PCT"
          ? Math.round(base * dv / 100)
          : Math.min(dv, base);
        const discountedBase = Math.max(0, base - discountAmt);
        const halfGst  = gstRate / 2;
        const cgst     = Math.round(discountedBase * halfGst / 100);
        const sgst     = Math.round(discountedBase * halfGst / 100);
        const total    = discountedBase + cgst + sgst;
        const points   = Math.floor(total / 100);
        const dur      = billingAppt.durationSlots * SLOT_MINS;
        const dateStr  = selectedDate.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });

        const PAY_OPTS = [
          { id:"CASH" as const, label:"Cash", Icon:Banknote   },
          { id:"CARD" as const, label:"Card", Icon:CreditCard },
          { id:"UPI"  as const, label:"UPI",  Icon:Smartphone },
        ];

        const cardNumDisplay = cardDetails.number.replace(/(.{4})/g,"$1 ").trim();
        const cardValid = payMethod !== "CARD" || (
          cardDetails.number.length === 16 &&
          cardDetails.expiry.length === 5 &&
          cardDetails.cvv.length    === 3 &&
          cardDetails.name.trim().length > 0
        );

        const upiUrl = `upi://pay?pa=lumi@upi&pn=Lumi+Salon&am=${total}&tn=${currentInvNum}`;
        const qrSrc  = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}&bgcolor=FCF5F6&color=2D1B1F&margin=2`;

        const doProcess = async () => {
          if (!billingAppt.customerCode || !billingAppt.serviceId) {
            toast.error("This appointment is missing customer/service data and can't be billed. Try re-booking it.");
            return;
          }
          setPayProcessing(true);
          const methodLabel = PAY_OPTS.find(p => p.id === payMethod)?.label ?? payMethod;
          try {
            const res = await fetch("/api/invoices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: billingAppt.customerCode,
                appointmentId: billingAppt.id,
                items: [{
                  type: "Service", dbId: billingAppt.serviceId, name: billingAppt.service,
                  unitPrice: base, qty: 1, gstRate,
                }],
                rawSubtotal: base,
                discountAmt,
                discountNote: discountNote.trim(),
                gstRate, cgst, sgst, total,
                paidAmt: total,
                methodLabel,
              }),
            });
            const json = await res.json();
            if (!json.success) { toast.error(json.error || "Could not create invoice."); setPayProcessing(false); return; }
            setCurrentInvNum(json.data.id);
            await changeStatus(billingAppt.id, "COMPLETED");
            setPayProcessing(false);
            setPayDone(true);
          } catch {
            toast.error("Network error — invoice was not created.");
            setPayProcessing(false);
          }
        };

        const closeAll = () => {
          setBillingAppt(null);
          setDetailAppt(null);
          setPayDone(false);
          setCardDetails({ number:"", expiry:"", cvv:"", name:"" });
          setDiscountVal("");
          setDiscountNote("");
          setDiscountType("PCT");
          setShowA4(false);
        };

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => { if (!payProcessing) { if (payDone) closeAll(); else setBillingAppt(null); } }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden flex flex-col">

              {/* Dark header */}
              <div className="p-5 flex-shrink-0" style={{ background:"linear-gradient(135deg,#2D1B1F,#1A0F12)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"#B76E7930" }}>
                      <Receipt className="w-4 h-4" style={{ color:"#E8C5CB" }} />
                    </div>
                    <div>
                      <p className="text-white font-display font-bold text-sm">
                        {payDone ? "Invoice" : "Generate Invoice"}
                      </p>
                      <p className="text-[10px]" style={{ color:"#C4A0A8" }}>{currentInvNum} - {dateStr}</p>
                    </div>
                  </div>
                  {!payProcessing && (
                    <button onClick={() => { if (payDone) closeAll(); else setBillingAppt(null); }}
                      className="p-1.5 rounded-lg hover:bg-white/10">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:"#ffffff12" }}>
                  <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ background:s.grad }}>
                    {billingAppt.customer.split(" ").map((n)=>n[0]).join("").slice(0,2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{billingAppt.customer}</p>
                    <p className="text-[10px]" style={{ color:"#C4A0A8" }}>{billingAppt.phone || "No phone"} - {s.name}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto flex-1" style={{ maxHeight:"78vh" }}>

                {/* PROCESSING */}
                {payProcessing ? (
                  <div className="flex flex-col items-center py-12 gap-4 p-5">
                    <div className="w-14 h-14 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
                    <p className="text-sm font-semibold text-foreground">Processing Payment...</p>
                    <p className="text-xs text-muted-foreground">Please wait, do not close this window</p>
                  </div>

                ) : payDone ? (
                  /* INVOICE VIEW */
                  <div className="p-4">
                    <div className="rounded-2xl overflow-hidden border" style={{ borderColor:"#EDD0D4" }}>

                      {/* Salon letterhead */}
                      <div className="py-5 px-4 text-center flex flex-col items-center justify-center gap-1.5" style={{ background:"linear-gradient(135deg,#B76E79,#C4956A)" }}>
                        {settings?.logo ? (
                          <img src={settings.logo} className="h-24 max-w-[200px] object-contain" alt="Logo" />
                        ) : (
                          <div>
                            <p className="text-white font-display font-bold text-xl tracking-wide uppercase">{settings?.salonName || "LUMI"}</p>
                            <p className="text-white/80 text-[9px] tracking-[0.2em] uppercase mt-0.5">{settings?.tagline || "Where Beauty Meets Luxury"}</p>
                          </div>
                        )}
                        <p className="text-white/65 text-[9px] mt-1.5">
                          GSTIN: {settings?.gstin || "27AABCE1234F1Z5"} - {settings?.phone || "022-12345678"} - {settings?.email || "hello@lumisalon.in"}
                        </p>
                      </div>

                      {/* Invoice meta bar */}
                      <div className="flex justify-between items-center px-4 py-2.5"
                        style={{ background:"#FCF5F6", borderBottom:"1px solid #EDD0D4" }}>
                        <div>
                          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Invoice No.</p>
                          <p className="text-sm font-bold text-foreground">{currentInvNum}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Date</p>
                          <p className="text-sm font-bold text-foreground">{dateStr}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Status</p>
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-700"
                            style={{ background:"#D1FAE5" }}>PAID</span>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Bill To + Stylist */}
                        <div className="flex justify-between">
                          <div>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
                            <p className="text-sm font-bold text-foreground">{billingAppt.customer}</p>
                            {billingAppt.phone && <p className="text-xs text-muted-foreground">{billingAppt.phone}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Stylist</p>
                            <p className="text-xs font-semibold text-foreground">{s.name}</p>
                            <p className="text-[9px] text-muted-foreground">{s.role}</p>
                          </div>
                        </div>

                        {/* Service row */}
                        <div>
                          <div className="grid grid-cols-12 pb-1.5 mb-2" style={{ borderBottom:"1.5px solid #EDD0D4" }}>
                            <p className="col-span-6 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Service</p>
                            <p className="col-span-3 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Time</p>
                            <p className="col-span-3 text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-right">Amount</p>
                          </div>
                          <div className="grid grid-cols-12 items-center py-1">
                            <div className="col-span-6">
                              <p className="text-xs font-semibold text-foreground leading-snug">{billingAppt.service}</p>
                              <p className="text-[9px] text-muted-foreground">{dur} min</p>
                            </div>
                            <p className="col-span-3 text-[10px] text-muted-foreground leading-tight">
                              {slotToTime(billingAppt.startSlot)}<br />{slotToTime(billingAppt.startSlot + billingAppt.durationSlots)}
                            </p>
                            <p className="col-span-3 text-xs font-semibold text-foreground text-right">
                              Rs.{base.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>

                        {/* Tax breakdown */}
                        <div className="space-y-1.5 pt-3" style={{ borderTop:"1px solid #EDD0D4" }}>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Subtotal</span>
                            <span className="text-xs text-muted-foreground">Rs.{base.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">CGST @ {halfGst}%</span>
                            <span className="text-xs text-muted-foreground">Rs.{cgst.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">SGST @ {halfGst}%</span>
                            <span className="text-xs text-muted-foreground">Rs.{sgst.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2.5"
                            style={{ borderTop:"2px solid #B76E79" }}>
                            <span className="text-sm font-bold text-foreground">Total</span>
                            <span className="text-lg font-display font-bold" style={{ color:"#B76E79" }}>
                              Rs.{total.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        {/* Paid badge */}
                        <div className="flex items-center justify-between p-3 rounded-xl"
                          style={{ background:"#D1FAE5", border:"1px solid #A7F3D0" }}>
                          <span className="text-xs font-bold text-emerald-800">Paid via {payMethod}</span>
                          <span className="text-xs font-bold text-emerald-700">Rs.{total.toLocaleString("en-IN")}</span>
                        </div>

                        {/* Loyalty */}
                        <p className="text-[9px] text-center" style={{ color:"#C4956A" }}>
                          {points} loyalty points credited to {billingAppt.customer.split(" ")[0]}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="px-4 py-3 text-center"
                        style={{ background:"#FCF5F6", borderTop:"1px solid #EDD0D4" }}>
                        <p className="text-[9px] text-muted-foreground font-medium">Thank you for visiting Lumi!</p>
                        <p className="text-[8px] text-muted-foreground mt-0.5">Queries: 022-12345678 - hello@lumisalon.in</p>
                      </div>
                    </div>

                    {/* Print + Done */}
                    <div className="flex gap-2 mt-4 pb-1">
                      <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                        style={{ borderColor:"#EDD0D4", color:"#B76E79", background:"white" }}
                        onClick={() => setShowA4(true)}>
                        View A4 / Print
                      </button>
                      <button className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                        style={{ background:"linear-gradient(135deg,#B76E79,#C4956A)" }}
                        onClick={closeAll}>
                        Done
                      </button>
                    </div>
                  </div>

                ) : (
                  /* BILLING FORM */
                  <div className="p-5 space-y-4">

                    {/* Service summary */}
                    <div className="p-3 rounded-xl" style={{ background:"#FCF5F6", border:"1px solid #EDD0D4" }}>
                      <p className="text-xs font-bold text-foreground">{billingAppt.service}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {slotToTime(billingAppt.startSlot)} to {slotToTime(billingAppt.startSlot + billingAppt.durationSlots)} - {dur} min - {s.role}
                      </p>
                    </div>

                    {/* GST Rate */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">GST Rate</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([5, 18] as const).map(rate => (
                          <button key={rate} onClick={() => setGstRate(rate)}
                            className="py-2.5 rounded-xl border text-sm font-bold transition-all"
                            style={{
                              borderColor: gstRate===rate ? "#B76E79" : "#EDD0D4",
                              background:  gstRate===rate ? "#FCF5F6" : "white",
                              color:       gstRate===rate ? "#B76E79" : "#9CA3AF",
                            }}>
                            {rate}%{" "}
                            <span className="text-[9px] font-normal" style={{ color:gstRate===rate?"#9A5D67":"#9CA3AF" }}>
                              {rate === 5 ? "(Reduced)" : "(Standard)"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Discount */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Discount (Optional)</p>
                      <div className="p-3 rounded-xl space-y-2.5" style={{ background:"#FCF5F6", border:"1px solid #EDD0D4" }}>
                        <div className="flex gap-2">
                          {([["PCT","% Off"],["FLAT","Rs. Off"]] as const).map(([v,l]) => (
                            <button key={v} onClick={() => { setDiscountType(v); setDiscountVal(""); }}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                              style={{
                                borderColor: discountType===v ? "#B76E79" : "#EDD0D4",
                                background:  discountType===v ? "#fff" : "transparent",
                                color:       discountType===v ? "#B76E79" : "#9CA3AF",
                              }}>
                              {l}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                            {discountType === "PCT" ? "%" : "Rs."}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max={discountType === "PCT" ? "100" : String(base)}
                            value={discountVal}
                            onChange={e => setDiscountVal(e.target.value)}
                            placeholder={discountType === "PCT" ? "e.g. 10 for 10% off" : "e.g. 200 for Rs.200 off"}
                            className="w-full pl-8 pr-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                          />
                        </div>
                        {discountAmt > 0 && (
                          <p className="text-[10px] font-semibold" style={{ color:"#10B981" }}>
                            Discount applied: Rs.{discountAmt.toLocaleString("en-IN")} off
                          </p>
                        )}
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1 block">Reason for Discount</label>
                          <textarea
                            value={discountNote}
                            onChange={e => setDiscountNote(e.target.value)}
                            placeholder="e.g. Loyalty Gold member, Birthday special, Complaint resolution..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Price breakdown */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Price Breakdown</p>
                      <div className="flex justify-between">
                        <span className="text-sm text-foreground">Service Charge</span>
                        <span className="text-sm font-semibold text-foreground">Rs.{base.toLocaleString("en-IN")}</span>
                      </div>
                      {discountAmt > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm" style={{ color:"#10B981" }}>
                            Discount {discountType==="PCT" ? `(${discountVal}%)` : "(Flat)"}
                          </span>
                          <span className="text-sm font-semibold" style={{ color:"#10B981" }}>
                            - Rs.{discountAmt.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">CGST @ {halfGst}%</span>
                        <span className="text-sm font-semibold text-muted-foreground">Rs.{cgst.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">SGST @ {halfGst}%</span>
                        <span className="text-sm font-semibold text-muted-foreground">Rs.{sgst.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2" style={{ borderTop:"1.5px solid #EDD0D4" }}>
                        <span className="text-sm font-bold text-foreground">Total Payable</span>
                        <span className="text-lg font-display font-bold" style={{ color:"#B76E79" }}>Rs.{total.toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    {/* Payment method */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payment Method</p>
                      <div className="grid grid-cols-3 gap-2">
                        {PAY_OPTS.map(({ id, label, Icon }) => (
                          <button key={id} onClick={() => setPayMethod(id)}
                            className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all"
                            style={{
                              borderColor: payMethod===id ? "#B76E79" : "#EDD0D4",
                              background:  payMethod===id ? "#FCF5F6" : "white",
                              color:       payMethod===id ? "#B76E79" : "#6B7280",
                            }}>
                            <Icon className="w-4 h-4" />
                            <span className="text-[10px] font-semibold">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* UPI QR */}
                    {payMethod === "UPI" && (
                      <div className="flex flex-col items-center gap-3 p-4 rounded-2xl"
                        style={{ background:"#FCF5F6", border:"1px solid #EDD0D4" }}>
                        <img src={qrSrc} alt="UPI QR" width={176} height={176}
                          className="rounded-xl" style={{ border:"2px solid #EDD0D4" }} />
                        <div className="text-center">
                          <p className="text-xs font-bold text-foreground">Scan to Pay Rs.{total.toLocaleString("en-IN")}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            UPI ID: <span className="font-semibold" style={{ color:"#B76E79" }}>lumi@upi</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">PhonePe - GPay - Paytm - BHIM</p>
                        </div>
                      </div>
                    )}

                    {/* CARD form */}
                    {payMethod === "CARD" && (
                      <div className="space-y-3">
                        <div className="relative h-36 rounded-2xl p-4 flex flex-col justify-between overflow-hidden"
                          style={{ background:"linear-gradient(135deg,#2D1B1F 0%,#B76E79 55%,#C4956A 100%)" }}>
                          <div className="flex justify-between items-start">
                            <div className="w-8 h-5 rounded-sm"
                              style={{ background:"linear-gradient(135deg,#FFD700,#FFA500)", opacity:0.85 }} />
                            <span className="text-white text-xs font-bold tracking-widest opacity-75">VISA</span>
                          </div>
                          <div>
                            <p className="text-white font-mono text-sm tracking-[0.18em] mb-2 drop-shadow">
                              {cardNumDisplay || "xxxx xxxx xxxx xxxx"}
                            </p>
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-white/50 text-[8px] uppercase tracking-wider">Cardholder</p>
                                <p className="text-white text-[11px] font-semibold tracking-wide truncate max-w-[140px]">
                                  {cardDetails.name || "YOUR NAME"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-white/50 text-[8px] uppercase tracking-wider">Expires</p>
                                <p className="text-white text-[11px] font-semibold">{cardDetails.expiry || "MM/YY"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1 block">Card Number</label>
                          <input className="input-luxury w-full text-sm font-mono tracking-widest"
                            placeholder="1234 5678 9012 3456" maxLength={19}
                            value={cardNumDisplay}
                            onChange={e => setCardDetails(p => ({ ...p, number: e.target.value.replace(/\D/g,"").slice(0,16) }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">Expiry</label>
                            <input className="input-luxury w-full text-sm font-mono" placeholder="MM/YY" maxLength={5}
                              value={cardDetails.expiry}
                              onChange={e => {
                                const raw = e.target.value.replace(/\D/g,"").slice(0,4);
                                setCardDetails(p => ({ ...p, expiry: raw.length > 2 ? raw.slice(0,2)+"/"+raw.slice(2) : raw }));
                              }} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">CVV</label>
                            <input className="input-luxury w-full text-sm font-mono" placeholder="xxx" maxLength={3} type="password"
                              value={cardDetails.cvv}
                              onChange={e => setCardDetails(p => ({ ...p, cvv: e.target.value.replace(/\D/g,"").slice(0,3) }))} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1 block">Cardholder Name</label>
                          <input className="input-luxury w-full text-sm uppercase tracking-wide" placeholder="AS ON CARD"
                            value={cardDetails.name}
                            onChange={e => setCardDetails(p => ({ ...p, name: e.target.value.toUpperCase() }))} />
                        </div>
                      </div>
                    )}

                    {/* Loyalty */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl"
                      style={{ background:"#FBF6F0", border:"1px solid #EACFB0" }}>
                      <span className="text-amber-500 text-sm">*</span>
                      <p className="text-xs text-amber-700">Customer earns <strong>{points} loyalty points</strong> (1 pt per Rs.100)</p>
                    </div>

                    {/* Confirm */}
                    <button disabled={!cardValid} onClick={doProcess}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background:"linear-gradient(135deg,#B76E79,#C4956A)" }}>
                      <Receipt className="w-4 h-4" />
                      {payMethod === "UPI"  ? `Paid via UPI - Rs.${total.toLocaleString("en-IN")}`  :
                       payMethod === "CARD" ? `Charge Card - Rs.${total.toLocaleString("en-IN")}` :
                                             `Confirm Cash - Rs.${total.toLocaleString("en-IN")}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* A4 Invoice Viewer */}
      {showA4 && billingAppt && (() => {
        const s2      = STAFF.find(st => st.id === billingAppt.staffId)!;
        const base2   = servicePrice(billingAppt.service);
        const dv2     = Number(discountVal) || 0;
        const disc2   = discountType==="PCT" ? Math.round(base2*dv2/100) : Math.min(dv2,base2);
        const dBase2  = Math.max(0,base2-disc2);
        const hGst2   = gstRate/2;
        const a4Data: InvoiceData = {
          invoiceNo:     currentInvNum,
          date:          selectedDate.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}),
          customer:      billingAppt.customer,
          phone:         billingAppt.phone,
          stylist:       s2.name,
          stylistRole:   s2.role,
          items:         [{ description:billingAppt.service, type:"Service",
            amount:base2,
            detail:`${billingAppt.durationSlots*SLOT_MINS} min · ${slotToTime(billingAppt.startSlot)} – ${slotToTime(billingAppt.startSlot+billingAppt.durationSlots)}` }],
          subtotal:      dBase2,
          discountAmt:   disc2||undefined,
          discountLabel: discountType==="PCT"?`${dv2}%`:undefined,
          discountNote:  discountNote||undefined,
          cgst:          Math.round(dBase2*hGst2/100),
          sgst:          Math.round(dBase2*hGst2/100),
          halfGst:       hGst2,
          total:         dBase2+2*Math.round(dBase2*hGst2/100),
          payMethod:     payMethod,
          status:        "PAID",
          loyaltyPoints: Math.floor((dBase2+2*Math.round(dBase2*hGst2/100))/100),
          brandName:    settings?.salonName,
          brandTagline: settings?.tagline,
          brandAddress: settings?.address,
          brandGstin:   settings?.gstin,
          brandPhone:   settings?.phone,
          brandEmail:   settings?.email,
          brandLogo:    settings?.logo,
        };
        return <InvoiceA4 key="a4" data={a4Data} onClose={() => setShowA4(false)} />;
      })()}
    </div>
  );
}
