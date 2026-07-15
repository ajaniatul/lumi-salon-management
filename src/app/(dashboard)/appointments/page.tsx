"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { InvoiceA4, InvoiceData, generateInvoiceHTML } from "@/components/InvoiceA4";
import { ChevronLeft, ChevronRight, X, UserPlus, Users, Receipt, Banknote, CreditCard, Smartphone, Loader2, Copy, ClipboardPaste, Eye, Clock, Play, CheckCircle, UserX, XCircle, Trash2, CalendarDays, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";
import toast from "react-hot-toast";

// ─── Constants ───────────────────────────────────────────────────────────────
const SLOT_W       = 14;         // px per 5-min slot horizontal (14 × 12 = 168px/hour)
const SLOT_MINS    = 5;
const ROW_H        = 88;         // px per staff row
const STAFF_COL_W  = 168;        // px for the sticky staff label column

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
  if (i % 12 === 0) return "1.5px solid #BBBBBB";   // hour
  if (i % 6  === 0) return "1px solid #DDDDDD";      // half-hour
  if (i % 3  === 0) return "1px solid #EEEEEE";      // 15-min
  return "0.5px solid #F5F5F5";                       // 5-min
}

// ─── Static config ──────────────────────────────────────────────────────────
// Column colours for staff loaded from the database (cycled by index)
const STAFF_PALETTE = [
  { color:"#111111", grad:"linear-gradient(135deg,#111111,#444444)" },
  { color:"#7C3AED", grad:"linear-gradient(135deg,#7C3AED,#A78BFA)" },
  { color:"#0369A1", grad:"linear-gradient(135deg,#0369A1,#38BDF8)" },
  { color:"#047857", grad:"linear-gradient(135deg,#047857,#34D399)" },
  { color:"#B45309", grad:"linear-gradient(135deg,#B45309,#FCD34D)" },
  { color:"#BE185D", grad:"linear-gradient(135deg,#BE185D,#F472B6)" },
];

type StaffCol = { id: string; name: string; role: string; color: string; grad: string };
type SvcOpt   = { id: string; name: string; price: number; duration: number };
type PkgOpt   = { id: string; name: string; services: string[]; packagePrice: number };
type Customer = { id: string; name: string; phone: string; email: string; visits: number; tier: string };

const TIER_CHIP: Record<string,string> = {
  SILVER:"bg-gray-100 text-gray-500 border-gray-200",
  GOLD:"bg-amber-100 text-amber-600 border-amber-200",
  PLATINUM:"bg-primary-100 text-primary-600 border-primary-200",
};

type Status = "CONFIRMED"|"WAITING"|"IN_PROGRESS"|"COMPLETED"|"NO_SHOW"|"CANCELLED";
type ApptService = { id:string; name:string; price:number; gstRate:number };
type Appt = {
  id:string; staffId:string; customer:string; phone:string; customerCode?:string|null;
  service:string; services?:ApptService[];
  invoiceNumber?:string|null; invoiceTotal?:number|null;
  startSlot:number; durationSlots:number; status:Status; notes?:string
};

const STATUS_META: Record<Status,{label:string;badge:string}> = {
  CONFIRMED:   { label:"Confirmed",   badge:"bg-blue-100 text-blue-700 border border-blue-200" },
  WAITING:     { label:"Waiting",     badge:"bg-amber-100 text-amber-700 border border-amber-200" },
  IN_PROGRESS: { label:"In Progress", badge:"bg-emerald-100 text-emerald-700 border border-emerald-200" },
  COMPLETED:   { label:"Completed",   badge:"bg-gray-100 text-gray-500 border border-gray-200" },
  NO_SHOW:     { label:"No Show",     badge:"bg-orange-100 text-orange-600 border border-orange-200" },
  CANCELLED:   { label:"Cancelled",   badge:"bg-red-100 text-red-500 border border-red-200" },
};

// Same hues as STATUS_META's badges — used for the appointment block fill so status
// is readable at a glance on the calendar; the block's border carries the stylist color.
const STATUS_COLOR: Record<Status,string> = {
  CONFIRMED:   "#3B82F6",
  WAITING:     "#F59E0B",
  IN_PROGRESS: "#10B981",
  COMPLETED:   "#9CA3AF",
  NO_SHOW:     "#F97316",
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
  serviceIds: [] as string[],
  packageId:    "",
  packageName:  "",
  packagePrice: null as number | null,
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
  const [packages,    setPackages]    = useState<PkgOpt[]>([]);
  const [loadingDay,  setLoadingDay]  = useState(true);
  const [drag,        setDrag]        = useState<{staffId:string;start:number;end:number}|null>(null);
  const [bookModal,   setBookModal]   = useState<{staffId:string;startSlot:number;endSlot:number;editApptId?:string}|null>(null);
  const [detailAppt,  setDetailAppt]  = useState<Appt|null>(null);
  const [form,        setForm]        = useState(defaultForm);
  const [selectedDate,setSelectedDate]= useState(() => new Date());
  const [showCal,    setShowCal]     = useState(false);
  const [calMonth,   setCalMonth]    = useState(() => new Date());
  const calRef = useRef<HTMLDivElement>(null);
  const [billingAppt,  setBillingAppt]  = useState<Appt | null>(null);
  const [settings,     setSettings]     = useState<any>(null);
  const [movingApptId, setMovingApptId] = useState<string | null>(null);
  const [moveTarget,   setMoveTarget]   = useState<{staffId:string; slot:number} | null>(null);
  const [resizePreview, setResizePreview] = useState<{id:string; endSlot:number} | null>(null);
  const resizing = useRef<{id:string; staffId:string; startSlot:number; origEnd:number; startY:number; maxEnd:number} | null>(null);
  const [copiedAppt, setCopiedAppt] = useState<{customerCode:string|null; customer:string; phone:string; serviceIds:string[]; notes?:string; durationSlots:number} | null>(null);
  const [pasteConfirm, setPasteConfirm] = useState<{ staffId:string; slot:number; staffName:string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x:number; y:number; appt:Appt } | null>(null);
  const [cellContextMenu, setCellContextMenu] = useState<{ x:number; y:number; staffId:string; slot:number } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ staffId:string; slot:number } | null>(null);

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
        const [st, sv, set, pk] = await Promise.all([
          fetch("/api/staff").then(r => r.json()),
          fetch("/api/services").then(r => r.json()),
          fetch("/api/settings").then(r => r.json()),
          fetch("/api/packages").then(r => r.json()),
        ]);
        if (st.success) setSTAFF(st.data.map((s: any, i: number) => ({
          id: s.dbId, name: s.name, role: s.designation,
          color: STAFF_PALETTE[i % STAFF_PALETTE.length].color,
          grad:  STAFF_PALETTE[i % STAFF_PALETTE.length].grad,
        })));
        if (sv.success) setServices(sv.data.map((s: any) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })));
        if (set.success) setSettings(set.data);
        if (pk.success) setPackages(pk.data.map((p: any) => ({ id: p.id, name: p.name, services: p.services, packagePrice: p.packagePrice })));
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
        setForm({ ...defaultForm, serviceIds: services[0] ? [services[0].id] : [], fromSlot: toSlot(dayStart, 0), toSlot: toSlot(dayStart + 1, 0) });
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

  // ── global mousemove/mouseup for resizing an existing appointment's duration ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const { id, startSlot, origEnd, startY, maxEnd } = resizing.current;
      const deltaSlots = Math.round((e.clientX - startY) / SLOT_W);
      const endSlot = Math.min(maxEnd, Math.max(startSlot + 1, origEnd + deltaSlots));
      setResizePreview({ id, endSlot });
    };
    const onUp = () => {
      if (resizing.current) {
        const { id, origEnd } = resizing.current;
        // Read the latest preview in case state lagged behind the last mousemove.
        setResizePreview(prev => {
          const finalEnd = prev?.id === id ? prev.endSlot : origEnd;
          resizeApptRef.current(id, finalEnd);
          return null;
        });
        resizing.current = null;
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []); // empty — all state accessed via refs/functional setState

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

  // Extend/shrink an appointment's duration by dragging its bottom edge (staff + start time unchanged).
  const resizeAppt = async (id: string, endSlot: number) => {
    const appt = appts.find(a => a.id === id);
    if (!appt || endSlot === appt.startSlot + appt.durationSlots) return;
    const prevAppts = appts;
    setAppts(prev => prev.map(a => a.id === id ? { ...a, durationSlots: endSlot - a.startSlot } : a));
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: appt.staffId, startSlot: appt.startSlot, endSlot }),
      });
      const j = await res.json();
      if (!j.success) { setAppts(prevAppts); toast.error(j.error || "Could not resize appointment."); return; }
      toast.success("Appointment duration updated");
    } catch {
      setAppts(prevAppts);
      toast.error("Network error. Please try again.");
    }
  };
  // Keeps a live reference to resizeAppt so the zero-dependency mouseup effect below
  // (registered once) always calls the version closed over the latest `appts`, not
  // a stale copy from first render.
  const resizeApptRef = useRef(resizeAppt);
  useEffect(() => { resizeApptRef.current = resizeAppt; });

  // Close calendar on outside click
  useEffect(() => {
    if (!showCal) return;
    const handler = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCal]);

  // Clear copied appointment + context menu on Escape / outside click.
  useEffect(() => {
    const onKey   = (e: KeyboardEvent) => { if (e.key === "Escape") { setCopiedAppt(null); setContextMenu(null); setCellContextMenu(null); } };
    const onClick = () => { setContextMenu(null); setCellContextMenu(null); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click",   onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, []);

  // Paste a copied appointment onto another stylist's (or the same stylist's) empty slot —
  // lets two stylists attend the same customer for different services at the same time.
  const pasteAppt = async (staffId: string, startSlot: number) => {
    if (!copiedAppt) return;
    const endSlot = startSlot + copiedAppt.durationSlots;
    // API needs either customerCode (existing) OR newCustomer (walk-in) — never an empty string
    const body: Record<string, unknown> = {
      date: curKey, staffId, startSlot, endSlot,
      serviceIds: copiedAppt.serviceIds.length ? copiedAppt.serviceIds : undefined,
      notes: copiedAppt.notes,
    };
    if (copiedAppt.customerCode) {
      body.customerCode = copiedAppt.customerCode;
    } else {
      body.newCustomer = { name: copiedAppt.customer, phone: copiedAppt.phone, email: "" };
    }
    try {
      const res = await fetch("/api/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.success) { toast.error(j.error || "Could not paste appointment."); return; }
      setAppts(a => [...a, j.data]);
      setCopiedAppt(null);
      toast.success(`Pasted ${copiedAppt.customer}`);
    } catch {
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
  const canSubmit = timeValid && customerReady;
  const [booking, setBooking] = useState(false);

  const submitBooking = async () => {
    if (!bookModal || !canSubmit || booking) return;
    setBooking(true);

    // ── EDIT MODE ────────────────────────────────────────────────────────────
    if (bookModal.editApptId) {
      try {
        const res = await fetch(`/api/appointments/${bookModal.editApptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId:      bookModal.staffId,
            startSlot:    form.fromSlot,
            endSlot:      form.toSlot,
            serviceIds:   form.serviceIds,
            packagePrice: form.packagePrice ?? undefined,
            notes:        form.packageName
              ? `[Package: ${form.packageName}]${form.notes ? ` ${form.notes}` : ""}`
              : form.notes,
          }),
        });
        const j = await res.json();
        if (!res.ok || !j.success) { toast.error(j.error || "Could not update appointment."); setBooking(false); return; }
        // Optimistic update with new service list
        const updatedSvcs = form.serviceIds.map(id => {
          const svc = services.find(s => s.id === id);
          return { id, name: svc?.name ?? "", price: svc?.price ?? 0, gstRate: 18 };
        });
        setAppts(prev => prev.map(a => a.id === bookModal.editApptId ? {
          ...a,
          staffId:       bookModal.staffId,
          startSlot:     form.fromSlot,
          durationSlots: form.toSlot - form.fromSlot,
          service:       updatedSvcs[0]?.name ?? a.service,
          services:      updatedSvcs,
          notes: form.packageName
            ? `[Package: ${form.packageName}]${form.notes ? ` ${form.notes}` : ""}`
            : form.notes || undefined,
        } : a));
        setBookModal(null);
        setForm(defaultForm);
        toast.success("Appointment updated");
      } catch {
        toast.error("Network error. Please try again.");
      } finally {
        setBooking(false);
      }
      return;
    }

    // ── NEW BOOKING ───────────────────────────────────────────────────────────
    const body: any = {
      date: curKey,
      staffId: bookModal.staffId,
      startSlot: form.fromSlot,
      endSlot: form.toSlot,
      serviceIds:   form.serviceIds,
      packagePrice: form.packagePrice ?? undefined,
      notes: form.packageName
        ? `[Package: ${form.packageName}]${form.notes ? ` ${form.notes}` : ""}`
        : form.notes,
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
      if (form.customerMode === "new") loadCustomers();
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
    <div className="px-6 flex flex-col gap-4 h-full" style={{ userSelect:"none" }}>

      {/* ── Date navigation ── */}
      <div className="flex items-center gap-2">
        <button onClick={prevDay} className="p-1.5 rounded-lg border border-ivory-300 hover:bg-ivory-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Clickable date → calendar dropdown */}
        <div className="relative" ref={calRef}>
          <button
            onClick={() => { setCalMonth(new Date(selectedDate)); setShowCal(v => !v); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ivory-300 hover:bg-ivory-100 transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">{formatDate(selectedDate)}</span>
          </button>

          {showCal && (() => {
            const y = calMonth.getFullYear();
            const m = calMonth.getMonth();
            const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const today = new Date();
            const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
            const selKey   = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
            const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const cells: (number | null)[] = [
              ...Array(firstDay).fill(null),
              ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
            ];
            // pad to full rows
            while (cells.length % 7 !== 0) cells.push(null);
            return (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-ivory-200 p-3 w-64">
                {/* Month header */}
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setCalMonth(new Date(y, m - 1, 1))}
                    className="p-1 rounded-lg hover:bg-ivory-100 transition-colors">
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <span className="text-xs font-bold text-foreground">{MONTHS[m]} {y}</span>
                  <button onClick={() => setCalMonth(new Date(y, m + 1, 1))}
                    className="p-1 rounded-lg hover:bg-ivory-100 transition-colors">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {/* Day labels */}
                <div className="grid grid-cols-7 mb-1">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                    <div key={d} className="text-center text-[9px] font-bold text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-y-0.5">
                  {cells.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const dKey = `${y}-${m}-${day}`;
                    const isToday = dKey === todayKey;
                    const isSel   = dKey === selKey;
                    return (
                      <button key={i}
                        onClick={() => {
                          const d = new Date(y, m, day);
                          setSelectedDate(d);
                          setShowCal(false);
                        }}
                        className={cn(
                          "w-full aspect-square rounded-lg text-xs font-semibold transition-colors flex items-center justify-center",
                          isSel   ? "text-white"                      : "",
                          isToday && !isSel ? "font-bold"             : "",
                          !isSel  ? "hover:bg-ivory-100"              : "",
                        )}
                        style={isSel ? { background:"#111111", color:"#fff" } : isToday ? { color:"#111111" } : {}}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                {/* Today button */}
                <div className="mt-2 pt-2 border-t border-ivory-100">
                  <button
                    onClick={() => { setSelectedDate(new Date()); setShowCal(false); }}
                    className="w-full text-xs font-semibold py-1.5 rounded-lg hover:bg-ivory-100 transition-colors text-center"
                    style={{ color:"#111111" }}>
                    Today
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        <button onClick={nextDay} className="p-1.5 rounded-lg border border-ivory-300 hover:bg-ivory-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        {loadingDay && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-1" />}
      </div>

      {/* ── Compact summary + legend (single slim row, keeps the grid tall) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label:"Total",       value:counts.total,      color:"#111111" },
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
        {copiedAppt ? (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300">
            <ClipboardPaste className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs text-gray-700">
              Copied <strong>{copiedAppt.customer}</strong> — click any empty slot to paste
            </span>
            <button onClick={() => setCopiedAppt(null)} className="text-xs text-gray-500 hover:text-gray-700 underline">
              Clear
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground ml-auto hidden md:block">Drag on empty space to book · click an appointment to manage</span>
        )}
      </div>

      {/* ── Scheduler — time ruler outside, rows fill frame dynamically ── */}
      <div
        className="flex flex-col"
        style={{ minHeight:0, flex:"1 1 0", overflow:"hidden" }}
        onMouseLeave={() => { if (dragging.current) { dragging.current = false; dragStaffRef.current = null; dragRef.current = null; setDrag(null); } }}
      >
        {/* Single horizontal-scroll wrapper — time ruler + card scroll together */}
        <div className="flex flex-col min-h-0" style={{ flex:"1 1 0", overflowX:"auto", overflowY:"hidden" }}>
          <div className="flex flex-col h-full" style={{ minWidth: STAFF_COL_W + totalSlots * SLOT_W }}>

          {/* ── Time ruler — OUTSIDE the card ── */}
          <div className="flex flex-shrink-0" style={{ height:30, borderBottom:"2px solid #CCCCCC" }}>
            {/* Corner */}
            <div className="flex-shrink-0 flex items-end pb-1 pl-2"
              style={{ width:STAFF_COL_W, minWidth:STAFF_COL_W, borderRight:"2px solid #CCCCCC" }}>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Staff / Time</span>
            </div>
            {/* Time ticks */}
            <div className="relative flex-shrink-0" style={{ width: totalSlots * SLOT_W }}>
              {Array.from({ length: totalSlots }, (_, i) => {
                const isHour = i % 12 === 0;
                const isHalf = i % 6  === 0 && !isHour;
                return isHour || isHalf ? (
                  <div key={i} className="absolute top-0 bottom-0 overflow-visible"
                    style={{ left: i * SLOT_W, width: 0, borderLeft: isHour ? "1.5px solid #BBBBBB" : "1px dashed #CCCCCC" }}>
                    {isHour && (
                      <span className="absolute text-[10px] font-semibold text-muted-foreground whitespace-nowrap"
                        style={{ top:6, left:3 }}>{slotToTime(i)}</span>
                    )}
                    {isHalf && (
                      <span className="absolute text-[9px] whitespace-nowrap" style={{ top:8, left:3, color:"#999999" }}>
                        {slotToTime(i).replace(" AM","").replace(" PM","")}
                      </span>
                    )}
                  </div>
                ) : null;
              })}
          </div>
        </div>

          {/* ── Staff rows card — fills remaining height ── */}
          <div className="card-luxury flex flex-col" style={{ flex:"1 1 0", minHeight:0 }}>
          {STAFF.map((s, si) => {
          const rowAppts   = dayAppts.filter(a => a.staffId === s.id);
          const dragMin    = drag?.staffId === s.id ? Math.min(drag.start, drag.end) : null;
          const dragMax    = drag?.staffId === s.id ? Math.max(drag.start, drag.end) : null;
          const movingAppt = movingApptId ? appts.find(a => a.id === movingApptId) : null;
          const moveMin    = movingAppt && moveTarget?.staffId === s.id ? moveTarget.slot : null;
          const moveMax    = movingAppt && moveTarget?.staffId === s.id ? moveTarget.slot + movingAppt.durationSlots - 1 : null;
          return (
            <div key={s.id} className="flex" style={{ flex:"1 1 0", minHeight:64, borderBottom: si < STAFF.length-1 ? "1px solid #E0E0E0" : undefined }}>
              {/* Staff label */}
              <div className="sticky left-0 z-10 bg-white flex-shrink-0 flex items-center gap-2.5 px-3"
                style={{ width:STAFF_COL_W, minWidth:STAFF_COL_W, borderRight:"2px solid #CCCCCC" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                  style={{ background:s.grad }}>
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

              {/* Time cells — fills row height */}
              <div className="relative flex-shrink-0" style={{ width: totalSlots * SLOT_W, height:"100%" }}>
                {/* Grid cells */}
                {Array.from({ length: totalSlots }, (_, i) => {
                  const occupied     = rowAppts.some(a => i >= a.startSlot && i < a.startSlot + a.durationSlots);
                  const inDrag       = dragMin !== null && dragMax !== null && i >= dragMin && i <= dragMax;
                  const inMoveTarget = moveMin !== null && moveMax !== null && i >= moveMin && i <= moveMax;
                  return (
                    <div key={i}
                      className={cn("absolute top-0 transition-colors",
                        inMoveTarget ? "bg-emerald-100" : inDrag ? "bg-gray-200" : occupied ? "" : "hover:bg-gray-100"
                      )}
                      style={{
                        left: i * SLOT_W, width: SLOT_W, height: "100%",
                        cursor: occupied ? "default" : copiedAppt ? "copy" : "crosshair",
                        borderLeft: borderForSlot(i),
                      }}
                      onMouseDown={e => {
                        e.preventDefault();
                        if (occupied) return;
                        if (copiedAppt) { setPasteConfirm({ staffId: s.id, slot: i, staffName: s.name }); return; }
                        onCellDown(s.id, i);
                      }}
                      onMouseEnter={() => { onCellEnter(s.id, i); if (!occupied) setHoverCell({ staffId: s.id, slot: i }); }}
                      onMouseLeave={() => setHoverCell(null)}
                      onDragOver={e => { if (movingApptId) { e.preventDefault(); setMoveTarget({ staffId: s.id, slot: i }); } }}
                      onDrop={e => {
                        e.preventDefault();
                        if (movingApptId) moveAppt(movingApptId, s.id, i);
                        setMovingApptId(null); setMoveTarget(null);
                      }}
                    />
                  );
                })}

                {/* Paste hover chip — shows when copiedAppt is active and user hovers an empty cell in this row */}
                {copiedAppt && hoverCell?.staffId === s.id && (() => {
                  const hSlot = hoverCell.slot;
                  const isOccupied = rowAppts.some(a => hSlot >= a.startSlot && hSlot < a.startSlot + a.durationSlots);
                  if (isOccupied) return null;
                  return (
                    <div className="absolute pointer-events-none z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-lg text-white text-[11px] font-bold whitespace-nowrap animate-pulse"
                      style={{
                        left:  hSlot * SLOT_W,
                        top:   "50%", transform: "translateY(-50%)",
                        background: "linear-gradient(135deg,#111111,#444444)",
                      }}>
                      <ClipboardPaste className="w-3 h-3" />
                      Paste {copiedAppt.customer}
                    </div>
                  );
                })()}

                {/* Drag preview */}
                {dragMin !== null && dragMax !== null && (
                  <div className="absolute inset-y-1 pointer-events-none rounded-lg z-10"
                    style={{
                      left:  dragMin * SLOT_W + 2,
                      width: (dragMax - dragMin + 1) * SLOT_W - 4,
                      background: `${s.color}18`,
                      border: `2px dashed ${s.color}`,
                    }}>
                    <p className="text-[10px] font-bold p-1.5 whitespace-nowrap" style={{ color:s.color }}>
                      {slotToTime(dragMin)} → {slotToTime(dragMax + 1)}
                      &nbsp;<span className="font-normal opacity-70">{(dragMax - dragMin + 1) * SLOT_MINS}m</span>
                    </p>
                  </div>
                )}

                {/* Appointment blocks */}
                {rowAppts.map(appt => {
                  const isCompleted  = appt.status === "COMPLETED";
                  const isCancelled  = appt.status === "CANCELLED";
                  const isInProgress = appt.status === "IN_PROGRESS";
                  const isWaiting    = appt.status === "WAITING";
                  const isMovable    = !isCompleted && !isCancelled;
                  const isResizing   = resizePreview?.id === appt.id;
                  const durationSlots = isResizing ? resizePreview!.endSlot - appt.startSlot : appt.durationSlots;
                  return (
                    <div key={appt.id}
                      draggable={isMovable && !isResizing}
                      onDragStart={e => { if (isMovable) { setMovingApptId(appt.id); e.dataTransfer.effectAllowed = "move"; } }}
                      onDragEnd={() => { setMovingApptId(null); setMoveTarget(null); }}
                      className={cn(
                        "absolute inset-y-1 rounded-lg overflow-hidden z-20 cursor-pointer transition-all duration-150",
                        !isResizing ? "hover:inset-y-0 hover:z-30 hover:shadow-xl" : "z-30",
                        isMovable ? "active:cursor-grabbing" : "",
                        isCancelled || isCompleted ? "opacity-55" : "",
                        movingApptId === appt.id ? "opacity-30" : ""
                      )}
                      style={{
                        left:  appt.startSlot * SLOT_W + 2,
                        width: durationSlots * SLOT_W - 4,
                        background: isCancelled ? "#FEE2E2" : appt.status === "NO_SHOW" ? "#FFEDD5" : `${STATUS_COLOR[appt.status]}55`,
                        border: `2px solid ${isCancelled ? "#EF4444" : appt.status === "NO_SHOW" ? "#F97316" : s.color}`,
                      }}
                      onClick={() => setDetailAppt(appt)}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, appt }); }}
                    >
                      <div className="p-1.5 h-full flex flex-col gap-0.5 overflow-hidden">
                        <p className="text-[11px] font-bold leading-tight truncate" style={{ color:isCompleted?"#7A6870":s.color }}>
                          {appt.customer}
                        </p>
                        {durationSlots >= 6 && (
                          <p className="text-[10px] text-foreground opacity-75 truncate leading-tight">{appt.service}</p>
                        )}
                        {durationSlots >= 9 && (
                          <p className="text-[9px] text-muted-foreground leading-tight">
                            {slotToTime(appt.startSlot)} – {slotToTime(appt.startSlot + durationSlots)}
                          </p>
                        )}
                        {durationSlots >= 9 && appt.notes && (
                          <p className="text-[9px] text-amber-500 font-medium">📌 Has notes</p>
                        )}
                        {durationSlots >= 12 && (
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
                      {/* Resize handle — right edge */}
                      {isMovable && (
                        <div
                          draggable={false}
                          onMouseDown={e => {
                            e.stopPropagation(); e.preventDefault();
                            const laterAppts = rowAppts.filter(a =>
                              a.id !== appt.id && a.status !== "CANCELLED" && a.startSlot >= appt.startSlot
                            );
                            const maxEnd = laterAppts.length ? Math.min(totalSlots, ...laterAppts.map(a => a.startSlot)) : totalSlots;
                            resizing.current = {
                              id: appt.id, staffId: appt.staffId, startSlot: appt.startSlot,
                              origEnd: appt.startSlot + appt.durationSlots, startY: e.clientX, maxEnd,
                            };
                            setResizePreview({ id: appt.id, endSlot: appt.startSlot + appt.durationSlots });
                          }}
                          onClick={e => e.stopPropagation()}
                          className="absolute right-0 inset-y-0 w-2 cursor-ew-resize hover:bg-black/10"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
          })}
          </div>{/* end card-luxury */}
          </div>{/* end minWidth inner */}
        </div>{/* end overflow-x-auto */}
      </div>{/* end outer */}

      {/* ── RIGHT-CLICK CONTEXT MENU ── */}
      {contextMenu && (() => {
        const { x, y, appt } = contextMenu;
        const s = STAFF.find(st => st.id === appt.staffId);
        const isDone    = appt.status === "COMPLETED";
        const isCancelled = appt.status === "CANCELLED" || appt.status === "NO_SHOW";
        const isActive  = !isDone && !isCancelled;
        // Flip left if too close to right edge
        const menuW = 220;
        const menuH = 340;
        const left  = x + menuW > window.innerWidth  ? x - menuW : x;
        const top   = y + menuH > window.innerHeight ? y - menuH : y;

        type MenuItem = { icon: React.ReactNode; label: string; action: () => void; danger?: boolean; disabled?: boolean; color?: string };
        type Sep = "sep";
        const items: (MenuItem | Sep)[] = [
          {
            icon: <Eye className="w-3.5 h-3.5" />, label: "View Details",
            action: () => { setDetailAppt(appt); setContextMenu(null); },
          },
          "sep",
          {
            icon: <Clock className="w-3.5 h-3.5" />, label: "Mark as Waiting",
            action: () => { changeStatus(appt.id, "WAITING"); setContextMenu(null); },
            disabled: appt.status === "WAITING" || isDone || isCancelled,
          },
          {
            icon: <Play className="w-3.5 h-3.5" />, label: "Start (In Progress)",
            action: () => { changeStatus(appt.id, "IN_PROGRESS"); setContextMenu(null); },
            disabled: appt.status === "IN_PROGRESS" || isDone || isCancelled,
            color: "#10B981",
          },
          {
            icon: <CheckCircle className="w-3.5 h-3.5" />, label: "Mark Complete",
            action: () => { changeStatus(appt.id, "COMPLETED"); setContextMenu(null); },
            disabled: isDone || isCancelled,
            color: "#6B7280",
          },
          "sep",
          {
            icon: <UserX className="w-3.5 h-3.5" />, label: "No Show",
            action: () => { changeStatus(appt.id, "NO_SHOW"); setContextMenu(null); },
            disabled: appt.status === "NO_SHOW" || isDone,
            danger: true,
          },
          {
            icon: <XCircle className="w-3.5 h-3.5" />, label: "Cancel Appointment",
            action: () => { changeStatus(appt.id, "CANCELLED"); setContextMenu(null); },
            disabled: isCancelled || isDone,
            danger: true,
          },
          "sep",
          {
            icon: <Copy className="w-3.5 h-3.5" />, label: "Copy Appointment",
            action: () => {
              setCopiedAppt({
                customerCode: appt.customerCode || null,
                customer: appt.customer, phone: appt.phone,
                serviceIds: appt.services?.map(sv => sv.id) ?? [],
                notes: appt.notes, durationSlots: appt.durationSlots,
              });
              toast.success(`Copied ${appt.customer} — click any empty slot to paste`);
              setContextMenu(null);
            },
          },
          {
            icon: <Receipt className="w-3.5 h-3.5" />, label: "Bill Customer",
            action: () => { setBillingAppt(appt); setContextMenu(null); },
            disabled: !!appt.invoiceNumber,
            color: "#111111",
          },
          "sep",
          {
            icon: <Trash2 className="w-3.5 h-3.5" />, label: "Delete",
            action: () => { deleteAppt(appt.id); setContextMenu(null); },
            danger: true,
          },
        ];

        return (
          <div
            className="fixed z-[200] bg-white rounded-xl shadow-2xl border border-ivory-200 py-1 overflow-hidden"
            style={{ left, top, width: menuW, minWidth: menuW }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-ivory-100" style={{ background:"#F5F5F5" }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: s?.grad }}>
                  {s?.name.split(" ").map((n:string)=>n[0]).join("") || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{appt.customer}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{appt.service}</p>
                </div>
                <span className={cn("ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold border flex-shrink-0", STATUS_META[appt.status]?.badge)}>
                  {STATUS_META[appt.status]?.label}
                </span>
              </div>
            </div>
            {/* Items */}
            <div className="py-1">
              {items.map((item, i) =>
                item === "sep" ? (
                  <div key={i} className="my-1 border-t border-ivory-100" />
                ) : (
                  <button
                    key={i}
                    disabled={item.disabled}
                    onClick={item.action}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors",
                      item.disabled
                        ? "opacity-35 cursor-not-allowed"
                        : item.danger
                          ? "text-red-600 hover:bg-red-50"
                          : "text-foreground hover:bg-ivory-50"
                    )}
                    style={!item.disabled && item.color ? { color: item.color } : undefined}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {item.label}
                  </button>
                )
              )}
            </div>
          </div>
        );
      })()}


      {/* ── PASTE CONFIRMATION ── */}
      {pasteConfirm && copiedAppt && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.55)" }}
          onClick={() => setPasteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-ivory-100" style={{ background:"#F5F5F5" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                  style={{ background:"linear-gradient(135deg,#111111,#444444)" }}>
                  <ClipboardPaste className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Paste Appointment?</p>
                  <p className="text-[11px] text-muted-foreground">This will create a new booking</p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-semibold text-foreground">{copiedAppt.customer}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Stylist</span>
                <span className="font-semibold text-foreground">{pasteConfirm.staffName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Time</span>
                <span className="font-semibold text-foreground">{slotToTime(pasteConfirm.slot)}</span>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                className="flex-1 py-2.5 rounded-xl border border-ivory-300 text-xs font-semibold text-muted-foreground hover:bg-ivory-50 transition-colors"
                onClick={() => setPasteConfirm(null)}
              >Cancel</button>
              <button
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors hover:opacity-90"
                style={{ background:"linear-gradient(135deg,#111111,#444444)" }}
                onClick={() => { pasteAppt(pasteConfirm.staffId, pasteConfirm.slot); setPasteConfirm(null); }}
              >Paste Here</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKING MODAL ── */}
      {bookModal && (() => {
        const s = STAFF.find(st => st.id === bookModal.staffId)!;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setBookModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden max-h-[92vh] flex flex-col">

              {/* Header */}
              <div className="p-5 border-b border-ivory-200 flex-shrink-0" style={{ background:"linear-gradient(135deg,#0a0a0a,#1A0F12)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-display font-bold text-base">
                      {bookModal.editApptId ? "Edit Appointment" : "New Appointment"}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold" style={{ background:s.grad }}>
                        {s.name.split(" ").map((n:string)=>n[0]).join("")}
                      </div>
                      <p className="text-xs" style={{ color:"rgba(255,255,255,0.65)" }}>
                        {s.name} · {timeValid ? `${slotToTime(form.fromSlot)} – ${slotToTime(form.toSlot)}` : "Select time below"}
                        {timeValid && <span className="ml-1 font-semibold" style={{ color:"rgba(255,255,255,0.9)" }}>({dur} min)</span>}
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
                    Customer {!bookModal.editApptId && <span className="text-red-400">*</span>}
                  </label>

                  {/* Edit mode: show customer as read-only */}
                  {bookModal.editApptId ? (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-ivory-50 border border-ivory-200">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ background:"linear-gradient(135deg,#111111,#444444)" }}>
                        {form.customer.split(" ").map(n => n[0]).join("").slice(0,2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{form.customer}</p>
                        <p className="text-[10px] text-muted-foreground">{form.phone}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground italic flex-shrink-0">locked</span>
                    </div>
                  ) : (
                  <>{/* Mode toggle */}
                  <div className="flex rounded-xl border border-ivory-300 overflow-hidden mb-3">
                    <button
                      className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors",
                        form.customerMode === "existing" ? "text-white" : "text-muted-foreground hover:bg-ivory-100"
                      )}
                      style={form.customerMode === "existing" ? { background:"#111111" } : {}}
                      onClick={() => setForm(p => ({ ...p, customerMode:"existing", customerId:"", customerSearch:"" }))}
                    >
                      <Users className="w-3.5 h-3.5" /> Existing Customer
                    </button>
                    <button
                      className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors border-l border-ivory-300",
                        form.customerMode === "new" ? "text-white" : "text-muted-foreground hover:bg-ivory-100"
                      )}
                      style={form.customerMode === "new" ? { background:"#111111" } : {}}
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
                              style={{ boxShadow:"0 8px 30px rgba(0,0,0,0.12)", border:"1px solid #d0d0d0", background:"#fff" }}>
                              {matches.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-center" style={{ color:"#222222" }}>
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
                                    background: form.customerId === c.id ? "#fafafa" : "transparent",
                                    borderBottom: "1px solid #f0f0f0",
                                  }}
                                  onMouseEnter={e => { if (form.customerId !== c.id) (e.currentTarget as HTMLElement).style.background = "#f0f0f0"; }}
                                  onMouseLeave={e => { if (form.customerId !== c.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                >
                                  {/* Avatar */}
                                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                                    style={{ background:"linear-gradient(135deg,#111111,#444444)" }}>
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
                                      style={{ background:"#111111" }}>✓</div>
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

                    </div>
                  )}
                  </>)}
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

                {/* ── Package (optional) ── */}
                {packages.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Package <span className="text-[10px] font-normal text-muted-foreground">(optional)</span>
                    </label>
                    {form.packageId ? (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-violet-50 border border-violet-200">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-violet-600">PKG</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-violet-700 truncate">{form.packageName}</p>
                          <p className="text-[10px] text-violet-500">
                            Rs.{form.packagePrice?.toLocaleString("en-IN")} bundle · {form.serviceIds.length} service{form.serviceIds.length !== 1 ? "s" : ""} included
                          </p>
                        </div>
                        <button type="button"
                          onClick={() => setForm(p => ({ ...p, packageId: "", packageName: "", packagePrice: null, serviceIds: [] }))}
                          className="p-1 rounded-lg hover:bg-violet-100 flex-shrink-0">
                          <X className="w-3.5 h-3.5 text-violet-500" />
                        </button>
                      </div>
                    ) : (
                      <select className="input-luxury w-full text-sm" value=""
                        onChange={e => {
                          const pkg = packages.find(p => p.id === e.target.value);
                          if (!pkg) return;
                          // Match package service names to loaded service IDs
                          const pkgSvcIds = pkg.services
                            .map((name: string) => services.find(s => s.name === name)?.id)
                            .filter(Boolean) as string[];
                          setForm(p => ({
                            ...p,
                            packageId:    pkg.id,
                            packageName:  pkg.name,
                            packagePrice: pkg.packagePrice,
                            serviceIds:   pkgSvcIds,
                          }));
                        }}>
                        <option value="">Select a package...</option>
                        {packages.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} — Rs.{pkg.packagePrice.toLocaleString("en-IN")}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* ── Services ── */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Services
                    {form.packageId && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">add extras on top of the package</span>}
                  </label>
                  <select className="input-luxury w-full text-sm" value=""
                    onChange={e => {
                      const id = e.target.value;
                      if (id) setForm(p => p.serviceIds.includes(id) ? p : { ...p, serviceIds: [...p.serviceIds, id] });
                    }}>
                    <option value="">Add a service...</option>
                    {services.filter(sv => !form.serviceIds.includes(sv.id)).map(sv => (
                      <option key={sv.id} value={sv.id}>{sv.name} — Rs.{sv.price.toLocaleString("en-IN")}</option>
                    ))}
                  </select>
                  {form.serviceIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.serviceIds.map(id => {
                        const sv = services.find(s => s.id === id);
                        if (!sv) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 text-xs pl-2 pr-1 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-200">
                            {sv.name}{!form.packageId && ` · Rs.${sv.price.toLocaleString("en-IN")}`}
                            <button type="button"
                              onClick={() => setForm(p => ({ ...p, serviceIds: p.serviceIds.filter(x => x !== id) }))}
                              className="p-0.5 rounded hover:bg-primary-100">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                      <p className="text-[10px] text-muted-foreground w-full mt-0.5">
                        {form.packageId
                          ? `Package: Rs.${form.packagePrice?.toLocaleString("en-IN")}${
                              form.serviceIds.length > (packages.find(p => p.id === form.packageId)?.services.length ?? 0)
                                ? ` + extras`
                                : ""
                            }`
                          : `Total: Rs.${form.serviceIds.reduce((sum, id) => sum + (services.find(s => s.id === id)?.price ?? 0), 0).toLocaleString("en-IN")}`
                        }
                      </p>
                    </div>
                  )}
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
                  style={{ background:"linear-gradient(135deg,#111111,#444444)" }}>
                  {bookModal.editApptId ? "Save Changes" : "Book Appointment"}
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
                {/* Services — full-width, all shown */}
                <div className="bg-ivory-50 rounded-xl p-2.5 border border-ivory-200">
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Services</p>
                  {detailAppt.services && detailAppt.services.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {detailAppt.services.map(sv => (
                        <span key={sv.id} className="inline-block text-[11px] font-semibold bg-white border border-ivory-200 px-2 py-0.5 rounded-lg text-foreground">
                          {sv.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-foreground">{detailAppt.service}</p>
                  )}
                </div>
                {/* Details grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
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
                {detailAppt.notes && (() => {
                  const pkgMatch = detailAppt.notes.match(/^\[Package:\s*([^\]]+)\]([\s\S]*)/);
                  const pkgName  = pkgMatch?.[1]?.trim();
                  const restNote = pkgMatch?.[2]?.trim();
                  return (
                    <>
                      {pkgName && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-50 border border-violet-200">
                          <span className="text-[9px] font-bold bg-violet-200 text-violet-700 px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0">PKG</span>
                          <p className="text-xs font-semibold text-violet-700 truncate">{pkgName}</p>
                        </div>
                      )}
                      {restNote && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Notes</p>
                          <p className="text-xs text-amber-800 leading-relaxed">{restNote}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
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
                  {/* Edit — only for active appointments */}
                  {detailAppt.status !== "COMPLETED" && detailAppt.status !== "CANCELLED" && detailAppt.status !== "NO_SHOW" && (
                    <button
                      className="w-full text-sm py-2 rounded-xl font-semibold border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5"
                      onClick={() => {
                        setDetailAppt(null);
                        // Extract package info from notes if present
                        const editNotes     = detailAppt.notes ?? "";
                        const pkgEditMatch  = editNotes.match(/^\[Package:\s*([^\]]+)\]([\s\S]*)/);
                        const editPkgName   = pkgEditMatch?.[1]?.trim() ?? "";
                        const editUserNotes = pkgEditMatch?.[2]?.trim() ?? editNotes;
                        const editPkg       = packages.find(p => p.name === editPkgName);
                        setForm({
                          customerMode: "existing",
                          customerId:   detailAppt.customerCode ?? "",
                          customerSearch: detailAppt.customer,
                          customer:     detailAppt.customer,
                          phone:        detailAppt.phone,
                          email:        "",
                          saveToDb:     true,
                          serviceIds:   detailAppt.services?.map(sv => sv.id) ?? [],
                          packageId:    editPkg?.id ?? "",
                          packageName:  editPkgName,
                          packagePrice: editPkg?.packagePrice ?? null,
                          notes:        editUserNotes,
                          fromSlot:     detailAppt.startSlot,
                          toSlot:       detailAppt.startSlot + detailAppt.durationSlots,
                        });
                        setBookModal({
                          staffId:     detailAppt.staffId,
                          startSlot:   detailAppt.startSlot,
                          endSlot:     detailAppt.startSlot + detailAppt.durationSlots,
                          editApptId:  detailAppt.id,
                        });
                      }}>
                      <Pencil className="w-3.5 h-3.5" /> Edit Appointment
                    </button>
                  )}
                  <button className="w-full text-sm py-2 rounded-xl font-semibold border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-1.5"
                    onClick={() => {
                      if (!detailAppt.customerCode || !detailAppt.services?.length) {
                        toast.error("This appointment is missing data and can't be copied.");
                        return;
                      }
                      setCopiedAppt({
                        customerCode: detailAppt.customerCode,
                        customer: detailAppt.customer,
                        phone: detailAppt.phone,
                        serviceIds: detailAppt.services.map(sv => sv.id),
                        notes: detailAppt.notes,
                        durationSlots: detailAppt.durationSlots,
                      });
                      setDetailAppt(null);
                      toast.success(`Copied ${detailAppt.customer} — click an empty slot to paste`);
                    }}>
                    <Copy className="w-3.5 h-3.5" /> Copy to Another Stylist
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BILLING MODAL */}
      {billingAppt && (() => {
        const s        = STAFF.find(st => st.id === billingAppt.staffId)!;
        const base         = billingAppt.services?.length ? billingAppt.services.reduce((sum, sv) => sum + sv.price, 0) : servicePrice(billingAppt.service);
        const dv           = Number(discountVal) || 0;
        const discountAmt  = discountType === "PCT"
          ? Math.round(base * dv / 100)
          : Math.min(dv, base);
        const discountedBase = Math.max(0, base - discountAmt);
        const halfGst  = gstRate / 2;
        const cgst     = discountedBase * halfGst / 100;
        const sgst     = discountedBase * halfGst / 100;
        const total    = Math.round(discountedBase + cgst + sgst);
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
          if (!billingAppt.customerCode || !billingAppt.services?.length) {
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
                items: billingAppt.services.map(sv => ({
                  type: "Service", dbId: sv.id, name: sv.name,
                  unitPrice: sv.price, qty: 1, gstRate,
                })),
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
              <div className="p-5 flex-shrink-0" style={{ background:"linear-gradient(135deg,#0a0a0a,#1A0F12)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"#11111130" }}>
                      <Receipt className="w-4 h-4" style={{ color:"#E8C5CB" }} />
                    </div>
                    <div>
                      <p className="text-white font-display font-bold text-sm">
                        {payDone ? "Invoice" : "Generate Invoice"}
                      </p>
                      <p className="text-[10px]" style={{ color:"rgba(255,255,255,0.65)" }}>{currentInvNum} - {dateStr}</p>
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
                    <p className="text-[10px]" style={{ color:"rgba(255,255,255,0.65)" }}>{billingAppt.phone || "No phone"} - {s.name}</p>
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
                    <div className="rounded-2xl overflow-hidden border" style={{ borderColor:"#e5e5e5" }}>

                      {/* Salon letterhead */}
                      <div className="py-5 px-4 text-center flex flex-col items-center justify-center gap-1.5" style={{ background:"linear-gradient(135deg,#111111,#444444)" }}>
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
                        style={{ background:"#fafafa", borderBottom:"1px solid #e5e5e5" }}>
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

                        {/* Service row(s) */}
                        <div>
                          <div className="grid grid-cols-12 pb-1.5 mb-2" style={{ borderBottom:"1.5px solid #e5e5e5" }}>
                            <p className="col-span-6 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Service</p>
                            <p className="col-span-3 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Time</p>
                            <p className="col-span-3 text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-right">Amount</p>
                          </div>
                          {(billingAppt.services?.length ? billingAppt.services : [{ id:"_", name: billingAppt.service, price: base, gstRate }]).map((sv, i) => (
                            <div key={sv.id ?? i} className="grid grid-cols-12 items-center py-1">
                              <div className="col-span-6">
                                <p className="text-xs font-semibold text-foreground leading-snug">{sv.name}</p>
                                {i === 0 && <p className="text-[9px] text-muted-foreground">{dur} min total</p>}
                              </div>
                              <p className="col-span-3 text-[10px] text-muted-foreground leading-tight">
                                {i === 0 ? (<>{slotToTime(billingAppt.startSlot)}<br />{slotToTime(billingAppt.startSlot + billingAppt.durationSlots)}</>) : "—"}
                              </p>
                              <p className="col-span-3 text-xs font-semibold text-foreground text-right">
                                Rs.{sv.price.toLocaleString("en-IN")}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Tax breakdown */}
                        <div className="space-y-1.5 pt-3" style={{ borderTop:"1px solid #e5e5e5" }}>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Subtotal</span>
                            <span className="text-xs text-muted-foreground">Rs.{base.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">CGST @ {halfGst}%</span>
                            <span className="text-xs text-muted-foreground">Rs.{cgst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">SGST @ {halfGst}%</span>
                            <span className="text-xs text-muted-foreground">Rs.{sgst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2.5"
                            style={{ borderTop:"2px solid #111111" }}>
                            <span className="text-sm font-bold text-foreground">Total</span>
                            <span className="text-lg font-display font-bold" style={{ color:"#111111" }}>
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

                      </div>

                      {/* Footer */}
                      <div className="px-4 py-3 text-center"
                        style={{ background:"#fafafa", borderTop:"1px solid #e5e5e5" }}>
                        <p className="text-[9px] text-muted-foreground font-medium">Thank you for visiting Lumi!</p>
                        <p className="text-[8px] text-muted-foreground mt-0.5">Queries: 022-12345678 - hello@lumisalon.in</p>
                      </div>
                    </div>

                    {/* Share + Print + Done */}
                    <div className="mt-4 pb-1 space-y-2">
                      {/* WhatsApp + SMS row */}
                      {billingAppt.phone && (
                        <div className="flex gap-2">
                          <button
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                            style={{ background:"#25D366" }}
                            onClick={() => {
                              const phone = billingAppt.phone.replace(/\D/g,"");
                              const dialCode = phone.startsWith("91") ? phone : `91${phone}`;
                              const invLink = `${window.location.origin}/invoice/${encodeURIComponent(currentInvNum)}`;
              const msg = `Hi ${billingAppt.customer.split(" ")[0]},\n\nThank you for visiting ${settings?.salonName || "our salon"}.\n\nInvoice: ${currentInvNum}\nAmount Paid: Rs.${total.toLocaleString("en-IN")} (incl. GST)\nPayment: ${payMethod}\n\nView your invoice: ${invLink}\n\nWe look forward to seeing you again.`;
                              window.open(`https://wa.me/${dialCode}?text=${encodeURIComponent(msg)}`, "_blank");
                            }}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            WhatsApp
                          </button>
                          <button
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                            style={{ background:"#3B82F6" }}
                            onClick={() => {
                              const phone = billingAppt.phone.replace(/\D/g,"");
                              const invLink = `${window.location.origin}/invoice/${encodeURIComponent(currentInvNum)}`;
              const msg = `${settings?.salonName || "Lumi Salon"} | Invoice ${currentInvNum} | Rs.${total.toLocaleString("en-IN")} | View: ${invLink}`;
                              window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, "_self");
                            }}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            SMS
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                          style={{ borderColor:"#e5e5e5", color:"#111111", background:"white" }}
                          onClick={() => setShowA4(true)}>
                          View A4 / Print
                        </button>
                        <button className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                          style={{ background:"linear-gradient(135deg,#111111,#444444)" }}
                          onClick={closeAll}>
                          Done
                        </button>
                      </div>
                    </div>
                  </div>

                ) : (
                  /* BILLING FORM */
                  <div className="p-5 space-y-4">

                    {/* Service summary */}
                    <div className="p-3 rounded-xl" style={{ background:"#fafafa", border:"1px solid #e5e5e5" }}>
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
                              borderColor: gstRate===rate ? "#111111" : "#e5e5e5",
                              background:  gstRate===rate ? "#fafafa" : "white",
                              color:       gstRate===rate ? "#111111" : "#9CA3AF",
                            }}>
                            {rate}%{" "}
                            <span className="text-[9px] font-normal" style={{ color:gstRate===rate?"#222222":"#9CA3AF" }}>
                              {rate === 5 ? "(Reduced)" : "(Standard)"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Discount */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Discount (Optional)</p>
                      <div className="p-3 rounded-xl space-y-2.5" style={{ background:"#fafafa", border:"1px solid #e5e5e5" }}>
                        <div className="flex gap-2">
                          {([["PCT","% Off"],["FLAT","Rs. Off"]] as const).map(([v,l]) => (
                            <button key={v} onClick={() => { setDiscountType(v); setDiscountVal(""); }}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                              style={{
                                borderColor: discountType===v ? "#111111" : "#e5e5e5",
                                background:  discountType===v ? "#fff" : "transparent",
                                color:       discountType===v ? "#111111" : "#9CA3AF",
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
                        <span className="text-sm font-semibold text-muted-foreground">Rs.{cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">SGST @ {halfGst}%</span>
                        <span className="text-sm font-semibold text-muted-foreground">Rs.{sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2" style={{ borderTop:"1.5px solid #e5e5e5" }}>
                        <span className="text-sm font-bold text-foreground">Total Payable</span>
                        <span className="text-lg font-display font-bold" style={{ color:"#111111" }}>Rs.{total.toLocaleString("en-IN")}</span>
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
                              borderColor: payMethod===id ? "#111111" : "#e5e5e5",
                              background:  payMethod===id ? "#fafafa" : "white",
                              color:       payMethod===id ? "#111111" : "#6B7280",
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
                        style={{ background:"#fafafa", border:"1px solid #e5e5e5" }}>
                        <img src={qrSrc} alt="UPI QR" width={176} height={176}
                          className="rounded-xl" style={{ border:"2px solid #e5e5e5" }} />
                        <div className="text-center">
                          <p className="text-xs font-bold text-foreground">Scan to Pay Rs.{total.toLocaleString("en-IN")}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            UPI ID: <span className="font-semibold" style={{ color:"#111111" }}>lumi@upi</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">PhonePe - GPay - Paytm - BHIM</p>
                        </div>
                      </div>
                    )}

                    {/* CARD form */}
                    {payMethod === "CARD" && (
                      <div className="space-y-3">
                        <div className="relative h-36 rounded-2xl p-4 flex flex-col justify-between overflow-hidden"
                          style={{ background:"linear-gradient(135deg,#0a0a0a 0%,#333333 55%,#555555 100%)" }}>
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

                    {/* Confirm */}
                    <button disabled={!cardValid} onClick={doProcess}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background:"linear-gradient(135deg,#111111,#444444)" }}>
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
        const base2   = billingAppt.services?.length ? billingAppt.services.reduce((sum, sv) => sum + sv.price, 0) : servicePrice(billingAppt.service);
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
          items:         (billingAppt.services?.length ? billingAppt.services : [{ id:"_", name: billingAppt.service, price: base2, gstRate }])
            .map((sv, i) => ({
              description: sv.name, type: "Service", amount: sv.price,
              detail: i === 0 ? `${billingAppt.durationSlots*SLOT_MINS} min total · ${slotToTime(billingAppt.startSlot)} – ${slotToTime(billingAppt.startSlot+billingAppt.durationSlots)}` : undefined,
            })),
          subtotal:      dBase2,
          discountAmt:   disc2||undefined,
          discountLabel: discountType==="PCT"?`${dv2}%`:undefined,
          discountNote:  discountNote||undefined,
          cgst:          dBase2*hGst2/100,
          sgst:          dBase2*hGst2/100,
          halfGst:       hGst2,
          total:         Math.round(dBase2+2*(dBase2*hGst2/100)),
          payMethod:     payMethod,
          status:        "PAID",
          brandName:    settings?.salonName,
          brandTagline: settings?.tagline,
          brandAddress: settings?.address,
          brandGstin:   settings?.gstin,
          brandPhone:   settings?.phone,
          brandEmail:   settings?.email,
          brandPhone2:  (settings as any)?.phone2,
          brandLogo:    settings?.logo,
        };
        return <InvoiceA4 key="a4" data={a4Data} onClose={() => setShowA4(false)} />;
      })()}
    </div>
  );
}
