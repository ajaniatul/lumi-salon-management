"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Phone, Mail, X, Loader2, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type StaffMember = {
  id: string; dbId: string; name: string; initials: string;
  designation: string; phone: string; email: string;
  isActive: boolean; specializations: string[];
  thisMonth: { appointments: number; revenue: number; completed: number };
  commissionRate: number;
};

const ROLE_LABELS: Record<string, string> = {
  SENIOR_STYLIST:"Senior Stylist", STYLIST:"Stylist", JUNIOR_STYLIST:"Junior Stylist",
  RECEPTIONIST:"Receptionist", MANAGER:"Manager",
};
const DESIG_COLORS: Record<string, string> = {
  "Senior Stylist":"bg-primary-100 text-primary-700",
  "Stylist":"bg-violet-100 text-violet-700",
  "Junior Stylist":"bg-blue-100 text-blue-700",
  "Receptionist":"bg-teal-100 text-teal-700",
  "Manager":"bg-amber-100 text-amber-700",
  "Colorist":"bg-pink-100 text-pink-700",
  "Makeup Artist":"bg-purple-100 text-purple-700",
};
const desigCls = (d: string) => DESIG_COLORS[d] ?? "bg-gray-100 text-gray-600";

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";

const DEFAULT_FORM = { name:"", designation:"Stylist", phone:"", email:"", salary:"", commRate:"10", commission:false, bio:"", specialization:"" };

export default function StaffPage() {
  const router = useRouter();
  const [staff,      setStaff]      = useState<StaffMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL"|"ACTIVE"|"INACTIVE">("ALL");
  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/staff?all=true")
      .then(r => r.json())
      .then(j => { if (j.success) setStaff(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const closeModal = () => { setShowModal(false); setErr(""); setForm(DEFAULT_FORM); };

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.designation.trim()) {
      setErr("Name, designation and phone are required."); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/staff", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:           form.name.trim(),
          designation:    form.designation.trim(),
          phone:          form.phone.trim(),
          email:          form.email.trim() || null,
          salary:         Number(form.salary) || 0,
          bio:            form.bio.trim() || null,
          specialization: form.specialization.trim() || null,
          commissionRate: form.commission ? Number(form.commRate) || 0 : 0,
        }),
      });
      const j = await res.json();
      if (j.success) { closeModal(); load(); }
      else setErr(j.error || "Failed to add staff.");
    } catch {
      setErr("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (s: StaffMember, e: React.MouseEvent) => {
    e.stopPropagation();
    const newVal = !s.isActive;
    setStaff(prev => prev.map(m => m.id === s.id ? { ...m, isActive: newVal } : m));
    try {
      const res = await fetch(`/api/staff/${s.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isActive: newVal }),
      });
      const j = await res.json();
      if (!j.success) { setStaff(prev => prev.map(m => m.id === s.id ? { ...m, isActive: !newVal } : m)); toast.error("Failed to update status"); }
      else toast.success(`${s.name} marked ${newVal ? "active" : "inactive"}`);
    } catch { setStaff(prev => prev.map(m => m.id === s.id ? { ...m, isActive: !newVal } : m)); toast.error("Network error"); }
  };

  const filtered = staff
    .filter(s => statusFilter === "ALL" ? true : statusFilter === "ACTIVE" ? s.isActive : !s.isActive)
    .filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.designation.toLowerCase().includes(query.toLowerCase()) ||
      s.phone.includes(query)
    );

  const active = staff.filter(s => s.isActive).length;
  const totalRevenue = staff.reduce((sum, s) => sum + s.thisMonth.revenue, 0);
  const topEarner    = [...staff].sort((a, b) => b.thisMonth.revenue - a.thisMonth.revenue)[0];

  return (
    <div className="px-6 space-y-6">

      {/* ── Summary chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:"Total Staff",  value: loading ? "—" : staff.length.toString(),  desc:"In team" },
          { label:"Active",       value: loading ? "—" : active.toString(),         desc:"Working today" },
          { label:"Top Earner",   value: loading || !topEarner ? "—" : topEarner.name.split(" ")[0], desc: topEarner ? `Rs.${topEarner.thisMonth.revenue.toLocaleString("en-IN")} this month` : "" },
          { label:"Total Revenue",value: loading ? "—" : `Rs.${totalRevenue.toLocaleString("en-IN")}`, desc:"This month, all staff" },
        ].map(s => (
          <div key={s.label} className="card-luxury p-4">
            <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-xs font-semibold text-foreground mt-1">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, role or phone…"
              className="pl-9 pr-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 w-56" />
          </div>
          <div className="flex rounded-xl border border-ivory-300 overflow-hidden">
            {(["ALL","ACTIVE","INACTIVE"] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={cn("px-3 py-2 text-xs font-semibold transition-all",
                  statusFilter === f ? "text-white" : "bg-white text-muted-foreground hover:bg-ivory-50"
                )}
                style={statusFilter === f ? { background: f === "INACTIVE" ? "#6B7280" : "#B76E79" } : {}}>
                {f === "ALL" ? "All" : f === "ACTIVE" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-fit text-sm py-2 px-4">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {/* ── Staff grid ── */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color:"#B76E79" }} />
          <p className="text-sm text-muted-foreground">Loading staff…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-luxury p-12 text-center">
          <p className="text-sm text-muted-foreground">{query ? "No staff match your search." : "No staff members yet."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <button key={s.id} onClick={() => router.push(`/staff/${s.id}`)}
              className="card-luxury p-5 text-left hover:shadow-luxury hover:-translate-y-0.5 transition-all group cursor-pointer">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 group-hover:scale-105 transition-transform"
                  style={{ background:"linear-gradient(135deg,#B76E79,#C4956A)" }}>
                  {s.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <p className="text-sm font-bold text-foreground group-hover:text-primary-600 transition-colors">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.id}</p>
                    </div>
                    <span className={cn("badge text-[9px] flex-shrink-0", desigCls(s.designation))}>{s.designation}</span>
                  </div>
                </div>
              </div>

              {s.specializations.length > 0 && (
                <p className="text-[10px] text-muted-foreground mb-3 line-clamp-1">
                  {s.specializations.slice(0, 2).join(", ")}{s.specializations.length > 2 ? ` +${s.specializations.length - 2}` : ""}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label:"Appointments", value: s.thisMonth.appointments },
                  { label:"Revenue",      value: `₹${(s.thisMonth.revenue / 1000).toFixed(0)}K` },
                  { label:"Commission",   value: s.commissionRate > 0 ? `${s.commissionRate}%` : "N/A" },
                ].map(k => (
                  <div key={k.label} className="bg-ivory-50 rounded-xl p-2 text-center border border-ivory-200">
                    <p className="text-sm font-bold text-foreground">{k.value}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Phone className="w-3 h-3 flex-shrink-0" /> {s.phone}
                </div>
                {s.email && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Mail className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{s.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-ivory-200 flex items-center justify-between">
                <button
                  onClick={e => toggleActive(s, e)}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border",
                    s.isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  )}>
                  {s.isActive
                    ? <ToggleRight className="w-3.5 h-3.5" />
                    : <ToggleLeft  className="w-3.5 h-3.5" />}
                  {s.isActive ? "Active" : "Inactive"}
                </button>
                <span className="text-[10px] text-primary-600 font-semibold group-hover:underline">View profile →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Add Staff Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(20,12,14,0.82)", backdropFilter:"blur(4px)" }}
          onClick={e => { if (e.target===e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Add New Staff Member</h3>
              <button onClick={closeModal} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Full Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Sneha Iyer" className={iCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Designation <span className="text-red-400">*</span></label>
                  <input value={form.designation} onChange={e => set("designation", e.target.value)} placeholder="e.g. Stylist" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Phone <span className="text-red-400">*</span></label>
                  <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit" className={iCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="work email" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Monthly Salary (Rs.)</label>
                  <input type="number" value={form.salary} onChange={e => set("salary", e.target.value)} placeholder="0" className={iCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Specialization(s)</label>
                <input value={form.specialization} onChange={e => set("specialization", e.target.value)}
                  placeholder="e.g. Hair Coloring, Keratin" className={iCls} />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.commission} onChange={e => set("commission", e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm text-foreground">Commission eligible</span>
                </label>
                {form.commission && (
                  <div className="flex-1">
                    <input type="number" value={form.commRate} onChange={e => set("commRate", e.target.value)}
                      placeholder="Rate %" className={iCls} />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Bio / Notes</label>
                <textarea value={form.bio} onChange={e => set("bio", e.target.value)}
                  placeholder="Experience, certifications…" rows={2} className={iCls + " resize-none"} />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={closeModal} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving…" : "Add Staff Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
