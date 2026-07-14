"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InvoiceA4, InvoiceData } from "@/components/InvoiceA4";
import {
  ArrowLeft, Phone, Mail, Calendar, Crown, Heart, Gift,
  FileText, Package, StickyNote, ClipboardList, Edit3, Save, X,
  CheckCircle, Clock, AlertCircle, Receipt, Printer, ChevronRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Appt = {
  id: string; date: string; service: string; stylist: string;
  duration: string; amount: number; status: string; time: string; invoiceId: string;
};
type InvLine = { name: string; type: "Service"|"Product"; code: string; amount: number };
type Inv = {
  id: string; dbId: string; date: string;
  subtotal: number; cgst: number; sgst: number;
  total: number; paid: number; due: number;
  method: string; status: string; items: InvLine[];
  discount: string; discountAmt: number;
};
type Pkg = { name: string; total: number; used: number; expiry: string; price: number; status: string };

type Notes = { allergies: string; preferences: string; general: string };

type CustomerProfile = {
  id: string; dbId: string; name: string; initials: string;
  phone: string; email: string; gender: string; dob: string;
  anniversary: string | null; memberSince: string;
  visits: number; totalSpent: number; lastVisit: string;
  membership: string | null; membershipExpiry: string | null; membershipDiscount: number;
  tags: string[]; notes: Notes;
  appts: Appt[]; invoices: Inv[]; packages: Pkg[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TIER_GRAD: Record<string, string> = {
  Platinum: "linear-gradient(135deg,#7C3AED,#A78BFA)",
  Gold:     "linear-gradient(135deg,#B45309,#FCD34D)",
  Silver:   "linear-gradient(135deg,#6B7280,#D1D5DB)",
};
const MEMBERSHIP_BENEFITS: Record<string, string[]> = {
  Platinum: ["20% off all services","Priority booking","Free monthly facial","Birthday gift ₹2,000","Dedicated stylist"],
  Gold:     ["15% off all services","Priority booking","Free quarterly facial","Birthday gift ₹1,000"],
  Silver:   ["10% off all services","Early access to offers","Birthday gift ₹500"],
};
const STATUS_META: Record<string, { label: string; cls: string }> = {
  COMPLETED:  { label:"Completed",   cls:"bg-emerald-100 text-emerald-700" },
  CONFIRMED:  { label:"Confirmed",   cls:"bg-blue-100 text-blue-700" },
  IN_PROGRESS:{ label:"In Progress", cls:"bg-primary-100 text-primary-600" },
  CANCELLED:  { label:"Cancelled",   cls:"bg-red-100 text-red-600" },
  WAITING:    { label:"Waiting",     cls:"bg-amber-100 text-amber-700" },
  NO_SHOW:    { label:"No Show",     cls:"bg-gray-100 text-gray-500" },
};
const INV_STATUS: Record<string, { label: string; cls: string }> = {
  PAID:       { label:"Paid",       cls:"bg-emerald-100 text-emerald-700" },
  PARTIAL:    { label:"Partial",    cls:"bg-blue-100 text-blue-700" },
  PENDING:    { label:"Unpaid",     cls:"bg-red-100 text-red-500" },
  INFLUENCER: { label:"Influencer", cls:"bg-violet-100 text-violet-700" },
};
const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";

type Tab = "overview"|"appointments"|"invoices"|"packages"|"notes";

export default function CustomerProfile({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [tab,      setTab]      = useState<Tab>("overview");

  // Notes edit state
  const [editNotes,  setEditNotes]  = useState(false);
  const [notesDraft, setNotesDraft] = useState<Notes>({ allergies:"", preferences:"", general:"" });
  const [savingNotes,setSavingNotes]= useState(false);

  // Profile edit state
  type ProfileDraft = { name:string; phone:string; email:string; gender:string; dob:string; anniversary:string; tags:string[] };
  const [editProfile,   setEditProfile]  = useState(false);
  const [profileDraft,  setProfileDraft] = useState<ProfileDraft>({ name:"", phone:"", email:"", gender:"", dob:"", anniversary:"", tags:[] });
  const [savingProfile, setSavingProfile]= useState(false);
  const [newTag,        setNewTag]       = useState("");

  // A4 invoice viewer
  const [a4Invoice, setA4Invoice] = useState<InvoiceData | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/customers/${params.id}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setCustomer(j.data);
        else setError(j.error || "Customer not found.");
      })
      .catch(() => setError("Could not load customer."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const saveNotes = async () => {
    if (!customer) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(notesDraft),
      });
      const j = await res.json();
      if (j.success) {
        setCustomer(c => c ? { ...c, notes: notesDraft } : c);
        setEditNotes(false);
        toast.success("Notes saved");
      } else {
        toast.error(j.error || "Failed to save notes");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingNotes(false);
    }
  };

  const openEditProfile = () => {
    if (!customer) return;
    // Convert display dates (dd Mon yyyy) back to YYYY-MM-DD for <input type="date">
    const parseDate = (s: string) => {
      if (!s) return "";
      const d = new Date(s);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    };
    setProfileDraft({
      name:        customer.name,
      phone:       customer.phone,
      email:       customer.email,
      gender:      customer.gender,
      dob:         parseDate(customer.dob),
      anniversary: parseDate(customer.anniversary ?? ""),
      tags:        [...customer.tags],
    });
    setNewTag("");
    setEditProfile(true);
  };

  const saveProfile = async () => {
    if (!customer) return;
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ _profileUpdate: true, ...profileDraft }),
      });
      const j = await res.json();
      if (j.success) {
        setCustomer(c => c ? {
          ...c,
          name:        profileDraft.name,
          phone:       profileDraft.phone,
          email:       profileDraft.email,
          gender:      profileDraft.gender,
          dob:         profileDraft.dob ? new Date(profileDraft.dob).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "",
          anniversary: profileDraft.anniversary ? new Date(profileDraft.anniversary).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : null,
          tags:        profileDraft.tags,
          initials:    profileDraft.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase(),
        } : c);
        setEditProfile(false);
        toast.success("Profile updated");
      } else {
        toast.error(j.error || "Failed to update profile");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color:"#B76E79" }} />
        <p className="text-sm text-muted-foreground">Loading customer profile…</p>
      </div>
    );
  }
  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-red-500">{error || "Customer not found."}</p>
        <button onClick={() => router.push("/customers")} className="btn-outline text-sm py-2 px-4 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </button>
      </div>
    );
  }

  const completedAppts  = customer.appts.filter(a => a.status === "COMPLETED");
  const upcomingAppts   = customer.appts.filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED" && a.status !== "NO_SHOW");
  const tierGrad        = customer.membership ? TIER_GRAD[customer.membership] : "linear-gradient(135deg,#B76E79,#C4956A)";

  const TABS: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id:"overview",     label:"Overview",     icon:ClipboardList },
    { id:"appointments", label:"Appointments", icon:Calendar },
    { id:"invoices",     label:"Invoices",     icon:Receipt },
    { id:"packages",     label:"Packages",     icon:Package },
    { id:"notes",        label:"Notes",        icon:StickyNote },
  ];

  return (
    <div className="space-y-5 pb-10">

      {/* ── Back ── */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.push("/customers")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Customers
        </button>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{customer.name}</span>
      </div>

      {/* ── Profile hero ── */}
      <div className="card-luxury overflow-hidden">
        <div className="h-20" style={{ background:"linear-gradient(135deg,#2D1B1F,#B76E79,#C4956A)" }} />
        <div className="px-6 pb-5">
          <div className="flex items-end justify-between -mt-8 mb-4">
            <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-xl font-bold text-white"
              style={{ background: tierGrad }}>
              {customer.initials}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => router.push("/appointments")} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Book Appointment
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-display font-bold text-foreground">{customer.name}</h2>
                {customer.membership && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ background: tierGrad }}>
                    <Crown className="w-3 h-3" /> {customer.membership}
                  </span>
                )}
                {customer.tags.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 border border-primary-200">{t}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {customer.id}
                {customer.gender ? ` · ${customer.gender}` : ""}
                {customer.dob ? ` · DOB: ${customer.dob}` : ""}
                {` · Member since ${customer.memberSince}`}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                {customer.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {customer.phone}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> {customer.email}
                  </span>
                )}
                {customer.anniversary && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Heart className="w-3.5 h-3.5 text-pink-400" /> Anniversary: {customer.anniversary}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* KPI chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label:"Total Visits",   value: customer.visits,                                              sub:`Last: ${customer.lastVisit}`,              color:"#B76E79" },
              { label:"Total Spent",    value:`Rs.${customer.totalSpent.toLocaleString("en-IN")}`,           sub:"Lifetime revenue",                          color:"#047857" },
              { label:"Membership",     value: customer.membership ?? "None",                                sub: customer.membershipExpiry ? `Expires ${customer.membershipExpiry}` : "No active plan", color:"#7C3AED" },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-3 border border-ivory-200" style={{ background:`${k.color}08` }}>
                <p className="text-lg font-display font-bold" style={{ color:k.color }}>{k.value}</p>
                <p className="text-[10px] font-semibold text-foreground">{k.label}</p>
                <p className="text-[9px] text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-ivory-100 rounded-2xl border border-ivory-200 w-fit overflow-x-auto">
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

          {/* Upcoming appointment */}
          {upcomingAppts.length > 0 ? (
            <div className="card-luxury p-5 border-l-4" style={{ borderLeftColor:"#B76E79" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary-600 mb-3">Upcoming Appointment</p>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{upcomingAppts[0].service}</p>
                  <p className="text-xs text-muted-foreground mt-1">{upcomingAppts[0].date} at {upcomingAppts[0].time}</p>
                  <p className="text-xs text-muted-foreground">Stylist: {upcomingAppts[0].stylist}</p>
                </div>
                <span className={cn("badge text-[10px]", STATUS_META[upcomingAppts[0].status]?.cls)}>
                  {STATUS_META[upcomingAppts[0].status]?.label}
                </span>
              </div>
            </div>
          ) : (
            <div className="card-luxury p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[100px]">
              <Calendar className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
              <button onClick={() => router.push("/appointments")} className="btn-primary text-xs py-1.5 px-3">Book Now</button>
            </div>
          )}

          {/* Membership */}
          <div className="card-luxury p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Membership</p>
            {customer.membership ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: tierGrad }}>
                    <Crown className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{customer.membership} Membership</p>
                    {customer.membershipExpiry && (
                      <p className="text-xs text-muted-foreground">Expires {customer.membershipExpiry}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  {(MEMBERSHIP_BENEFITS[customer.membership] ?? []).map(b => (
                    <div key={b} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <p className="text-xs text-foreground">{b}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active membership.{" "}
                <button onClick={() => router.push("/memberships")} className="text-primary-600 font-medium underline">Enroll now</button>
              </p>
            )}
          </div>

          {/* Recent visits */}
          <div className="card-luxury p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground">Recent Visits</p>
              <button onClick={() => setTab("appointments")} className="text-xs text-primary-600 font-medium hover:underline">
                View all {customer.visits}
              </button>
            </div>
            <div className="space-y-2">
              {completedAppts.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-ivory-50 rounded-xl border border-ivory-200">
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.service}</p>
                    <p className="text-xs text-muted-foreground">{a.date} · {a.stylist} · {a.invoiceId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">Rs.{a.amount.toLocaleString("en-IN")}</p>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_META[a.status]?.cls)}>
                      {STATUS_META[a.status]?.label}
                    </span>
                  </div>
                </div>
              ))}
              {completedAppts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No visit history yet.</p>
              )}
            </div>
          </div>

          {/* Special dates */}
          {(customer.dob || customer.anniversary) && (
            <div className="card-luxury p-5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Special Dates</p>
              <div className="space-y-3">
                {customer.dob && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                      <Gift className="w-4 h-4 text-pink-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Birthday</p>
                      <p className="text-xs text-muted-foreground">{customer.dob}</p>
                    </div>
                  </div>
                )}
                {customer.anniversary && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Anniversary</p>
                      <p className="text-xs text-muted-foreground">{customer.anniversary}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Staff notes preview */}
          <div className="card-luxury p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Staff Notes</p>
              <button onClick={() => setTab("notes")} className="text-xs text-primary-600 font-medium hover:underline">Edit</button>
            </div>
            {customer.notes.allergies ? (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 mb-2">
                <p className="text-[9px] font-bold text-red-500 uppercase tracking-wide mb-0.5">Allergy / Precaution</p>
                <p className="text-xs text-red-800">{customer.notes.allergies}</p>
              </div>
            ) : null}
            {customer.notes.general ? (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wide mb-0.5">Notes</p>
                <p className="text-xs text-amber-800 line-clamp-2">{customer.notes.general}</p>
              </div>
            ) : null}
            {!customer.notes.allergies && !customer.notes.general && (
              <p className="text-xs text-muted-foreground">No notes added yet. <button onClick={() => setTab("notes")} className="text-primary-600 underline">Add notes</button></p>
            )}
          </div>
        </div>
      )}

      {/* ══ APPOINTMENTS ═══════════════════════════════════════════════════════════ */}
      {tab === "appointments" && (
        <div className="card-luxury overflow-hidden">
          <div className="p-5 border-b border-ivory-200">
            <p className="text-sm font-bold text-foreground">Appointment History</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customer.appts.length} total · {completedAppts.length} completed · {upcomingAppts.length} upcoming
            </p>
          </div>
          {customer.appts.length === 0 ? (
            <div className="p-10 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No appointments yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ivory-50 border-b border-ivory-200">
                    {["Date","Service","Stylist","Duration","Amount","Status","Invoice"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customer.appts.map((a, i) => (
                    <tr key={a.id} className={cn("border-b border-ivory-100 hover:bg-ivory-50 transition-colors", i%2===0?"":"bg-ivory-50/40")}>
                      <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">{a.date}</td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{a.service}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{a.stylist}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.duration}</td>
                      <td className="px-4 py-3 text-xs font-bold text-foreground">
                        {a.amount > 0 ? `Rs.${a.amount.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_META[a.status]?.cls ?? "bg-gray-100 text-gray-600")}>
                          {STATUS_META[a.status]?.label ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-primary-600 font-medium">{a.invoiceId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ INVOICES ═══════════════════════════════════════════════════════════════ */}
      {tab === "invoices" && (
        <div className="space-y-3">
          {customer.invoices.length === 0 ? (
            <div className="card-luxury p-10 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            </div>
          ) : customer.invoices.map(inv => {
            const st = INV_STATUS[inv.status] ?? INV_STATUS.PENDING;
            const halfGst = inv.subtotal > 0 ? Math.round(inv.cgst / inv.subtotal * 100) : 9;
            return (
              <div key={inv.id} className="card-luxury overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-ivory-200"
                  style={{ background:"linear-gradient(90deg,#FCF5F6,white)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{inv.id}</p>
                      <p className="text-xs text-muted-foreground">{inv.date} · {inv.method}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[10px] px-2 py-1 rounded-full font-bold", st.cls)}>{st.label}</span>
                    <button onClick={() => setA4Invoice({
                      invoiceNo: inv.id, date: inv.date,
                      customer: customer.name, phone: customer.phone,
                      items: inv.items.map(it => ({ description:it.name, type:it.type, hsnCode:it.code, amount:it.amount })),
                      subtotal: inv.subtotal, discountAmt: inv.discountAmt || undefined,
                      discountNote: inv.discount || undefined,
                      cgst: inv.cgst, sgst: inv.sgst, halfGst,
                      total: inv.total, payMethod: inv.method === "-" ? "Pending" : inv.method,
                      status: inv.status as any,
                    })} className="p-1.5 rounded-lg hover:bg-ivory-100 transition-colors">
                      <Printer className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="bg-ivory-50 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 px-3 py-2 border-b border-ivory-200">
                      <p className="col-span-8 text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Item</p>
                      <p className="col-span-4 text-[9px] font-bold text-muted-foreground uppercase tracking-wide text-right">Amount</p>
                    </div>
                    {inv.items.map((it, i) => (
                      <div key={i} className="grid grid-cols-12 px-3 py-2.5 border-b border-ivory-100 last:border-0">
                        <div className="col-span-8">
                          <p className="text-xs font-medium text-foreground">{it.name}</p>
                          <p className="text-[9px] text-muted-foreground">{it.type} · {it.type==="Service"?"SAC":"HSN"} {it.code}</p>
                        </div>
                        <p className="col-span-4 text-xs font-semibold text-foreground text-right">Rs.{it.amount.toLocaleString("en-IN")}</p>
                      </div>
                    ))}
                    <div className="px-3 pb-3 space-y-1 border-t border-ivory-200 pt-2">
                      {(inv.discountAmt ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-xs text-emerald-600">Discount{inv.discount ? ` (${inv.discount})` : ""}</span>
                          <span className="text-xs text-emerald-600">−Rs.{(inv.discountAmt ?? 0).toLocaleString("en-IN")}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">CGST @ {halfGst}%</span>
                        <span className="text-xs text-muted-foreground">Rs.{inv.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">SGST @ {halfGst}%</span>
                        <span className="text-xs text-muted-foreground">Rs.{inv.sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-primary-200">
                        <span className="text-sm font-bold text-foreground">Total</span>
                        <span className="text-base font-display font-bold" style={{ color:"#B76E79" }}>
                          Rs.{inv.total.toLocaleString("en-IN")}
                        </span>
                      </div>
                      {inv.due > 0 && (
                        <div className="flex justify-between">
                          <span className="text-xs text-red-500 font-semibold">Balance Due</span>
                          <span className="text-xs text-red-500 font-semibold">Rs.{inv.due.toLocaleString("en-IN")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ PACKAGES ═══════════════════════════════════════════════════════════════ */}
      {tab === "packages" && (
        <div className="space-y-4">

          {/* Membership card */}
          <div className="card-luxury p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-4">Membership</p>
            {customer.membership ? (
              <>
                <div className="rounded-2xl p-5 text-white overflow-hidden relative" style={{ background: tierGrad }}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-white/70 text-[10px] uppercase tracking-widest">Lumi</p>
                      <p className="text-xl font-display font-bold mt-1">{customer.membership} Membership</p>
                    </div>
                    <Crown className="w-8 h-8 text-white/50" />
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-white/60 text-[9px] uppercase tracking-wider">Member Since</p>
                      <p className="text-sm font-semibold">{customer.memberSince}</p>
                    </div>
                    {customer.membershipExpiry && (
                      <div className="text-right">
                        <p className="text-white/60 text-[9px] uppercase tracking-wider">Expires</p>
                        <p className="text-sm font-semibold">{customer.membershipExpiry}</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-bold">{customer.name}</p>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Benefits included:</p>
                  {(MEMBERSHIP_BENEFITS[customer.membership] ?? []).map(b => (
                    <div key={b} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <p className="text-xs text-foreground">{b}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl p-5 border-2 border-dashed border-ivory-300 text-center">
                <Crown className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active membership</p>
                <button onClick={() => router.push("/memberships")} className="btn-primary text-xs mt-3 py-1.5 px-4">Enroll in Membership</button>
              </div>
            )}
          </div>

          {/* Packages */}
          <div className="card-luxury p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Service Packages</p>
              <button onClick={() => router.push("/packages")} className="btn-outline text-xs py-1 px-3">Browse Packages</button>
            </div>
            {customer.packages.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No packages purchased yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customer.packages.map((pkg, i) => {
                  const pct = pkg.total > 0 ? Math.round((pkg.used / pkg.total) * 100) : 0;
                  return (
                    <div key={i} className="p-4 rounded-xl border border-ivory-200 bg-ivory-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{pkg.name}</p>
                          <p className="text-xs text-muted-foreground">Rs.{pkg.price.toLocaleString("en-IN")} · Expires {pkg.expiry}</p>
                        </div>
                        <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold",
                          pkg.status==="ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                          {pkg.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-ivory-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width:`${pct}%`, background:"linear-gradient(90deg,#B76E79,#C4956A)" }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground whitespace-nowrap">{pkg.used}/{pkg.total} used</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{pkg.total - pkg.used} sessions remaining</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ══ NOTES ══════════════════════════════════════════════════════════════════ */}
      {tab === "notes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Staff Notes & Preferences</p>
            {!editNotes ? (
              <button onClick={() => { setNotesDraft({ ...customer.notes }); setEditNotes(true); }}
                className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Edit Notes
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditNotes(false)}
                  className="text-xs py-1.5 px-3 rounded-xl border border-ivory-300 text-muted-foreground hover:bg-ivory-100 flex items-center gap-1">
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button onClick={saveNotes} disabled={savingNotes}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-60">
                  {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                </button>
              </div>
            )}
          </div>

          {/* Allergies */}
          <div className="card-luxury p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-sm font-bold text-foreground">Allergies & Precautions</p>
            </div>
            {editNotes ? (
              <textarea className={iCls + " resize-none"} rows={3}
                value={notesDraft.allergies}
                onChange={e => setNotesDraft(d => ({ ...d, allergies: e.target.value }))}
                placeholder="Any known allergies, sensitivities, or medical precautions..." />
            ) : (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm text-red-800">{customer.notes.allergies || "None recorded."}</p>
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="card-luxury p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Heart className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-sm font-bold text-foreground">Preferences</p>
            </div>
            {editNotes ? (
              <textarea className={iCls + " resize-none"} rows={3}
                value={notesDraft.preferences}
                onChange={e => setNotesDraft(d => ({ ...d, preferences: e.target.value }))}
                placeholder="Seating, product, scheduling preferences..." />
            ) : (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-sm text-blue-800">{customer.notes.preferences || "None recorded."}</p>
              </div>
            )}
          </div>

          {/* General notes */}
          <div className="card-luxury p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <StickyNote className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-sm font-bold text-foreground">General Notes</p>
            </div>
            {editNotes ? (
              <textarea className={iCls + " resize-none"} rows={5}
                value={notesDraft.general}
                onChange={e => setNotesDraft(d => ({ ...d, general: e.target.value }))}
                placeholder="Any other notes about this customer..." />
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{customer.notes.general || "No notes added yet."}</p>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">Notes are visible to all staff.</p>
        </div>
      )}

      {a4Invoice && <InvoiceA4 data={a4Invoice} onClose={() => setA4Invoice(null)} />}

      {/* ── Edit Profile Modal ── */}
      {editProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4" style={{ color:"#B76E79" }} />
                <h3 className="text-sm font-display font-bold text-foreground">Edit Profile</h3>
              </div>
              <button onClick={() => setEditProfile(false)} className="p-1.5 rounded-lg hover:bg-ivory-100 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Full Name</label>
                <input className={iCls} value={profileDraft.name}
                  onChange={e => setProfileDraft(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Phone</label>
                <input className={iCls} value={profileDraft.phone} type="tel"
                  onChange={e => setProfileDraft(p => ({ ...p, phone: e.target.value }))} placeholder="Phone number" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Email</label>
                <input className={iCls} value={profileDraft.email} type="email"
                  onChange={e => setProfileDraft(p => ({ ...p, email: e.target.value }))} placeholder="Email address" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Gender</label>
                <select className={iCls} value={profileDraft.gender}
                  onChange={e => setProfileDraft(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">— Select —</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Date of Birth</label>
                <input className={iCls} value={profileDraft.dob} type="date"
                  onChange={e => setProfileDraft(p => ({ ...p, dob: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Anniversary</label>
                <input className={iCls} value={profileDraft.anniversary} type="date"
                  onChange={e => setProfileDraft(p => ({ ...p, anniversary: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {profileDraft.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 border border-primary-200">
                      {tag}
                      <button type="button" onClick={() => setProfileDraft(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }))}>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className={iCls + " flex-1"} value={newTag} placeholder="Add tag…"
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newTag.trim()) { setProfileDraft(p => ({ ...p, tags: [...p.tags, newTag.trim()] })); setNewTag(""); } }} />
                  <button type="button"
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100 transition-colors"
                    onClick={() => { if (newTag.trim()) { setProfileDraft(p => ({ ...p, tags: [...p.tags, newTag.trim()] })); setNewTag(""); } }}>
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200">
              <button onClick={() => setEditProfile(false)}
                className="flex-1 py-2 rounded-xl border border-ivory-300 text-sm font-semibold text-muted-foreground hover:bg-ivory-50 transition-colors">
                Cancel
              </button>
              <button onClick={saveProfile} disabled={savingProfile || !profileDraft.name.trim() || !profileDraft.phone.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ background:"linear-gradient(135deg,#B76E79,#C4956A)" }}>
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
