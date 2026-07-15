"use client";
import { useState, useEffect, useCallback } from "react";
import { Crown, X, Check, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";
import toast from "react-hot-toast";

type Tier = "SILVER" | "GOLD" | "PLATINUM";

type Plan = {
  id: string; tier: Tier; name: string; price: number;
  validity: string; validityDays: number; discount: number;
  benefits: string[]; members: number;
};

type Member = {
  id: string; customerId: string; customer: string; phone: string;
  tier: Tier; tierName: string; price: number;
  start: string; expiry: string; daysLeft: number; status: string;
};

const TIER_STYLE: Record<Tier, { color: string; bg: string; border: string; badge: string }> = {
  SILVER:   { color: "#9CA3AF", bg: "bg-gray-50",    border: "border-gray-200",    badge: "bg-gray-100 text-gray-600 border border-gray-200"    },
  GOLD:     { color: "#444444", bg: "bg-amber-50",   border: "border-amber-200",   badge: "bg-amber-100 text-amber-700 border border-amber-200"   },
  PLATINUM: { color: "#111111", bg: "bg-primary-50", border: "border-primary-200", badge: "bg-primary-100 text-primary-700 border border-primary-200" },
};

const VALIDITY_OPTIONS = [
  { label: "3 months",  days: 90  },
  { label: "6 months",  days: 180 },
  { label: "12 months", days: 365 },
];

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white";
const DEFAULT_FORM = { phone: "", planId: "", startDate: new Date().toISOString().slice(0, 10) };

export default function MembershipsPage() {
  const { setAction } = useHeaderAction();

  const [plans,     setPlans]     = useState<Plan[]>([]);
  const [members,   setMembers]   = useState<Member[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<"plans" | "members">("plans");
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState(DEFAULT_FORM);
  const [lookup,    setLookup]    = useState<{ name: string } | null>(null);
  const [looking,   setLooking]   = useState(false);
  const [err,       setErr]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit plan modal
  const [editPlan,     setEditPlan]     = useState<Plan | null>(null);
  const [editForm,     setEditForm]     = useState({ price: "", validityDays: "" });
  const [editSaving,   setEditSaving]   = useState(false);

  // New plan modal
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    name: "",
    tier: "SILVER" as Tier,
    price: "",
    validityDays: "90",
    discountPercent: "",
    benefits: [""]
  });
  const [newPlanErr, setNewPlanErr] = useState("");
  const [newPlanSubmitting, setNewPlanSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/memberships")
      .then(r => r.json())
      .then(j => {
        if (j.success) { setPlans(j.plans); setMembers(j.members); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const deleteMember = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer membership?")) return;
    try {
      const res = await fetch(`/api/memberships?id=${id}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (j.success) {
        toast.success(j.message || "Customer membership deleted.");
        load();
      } else {
        toast.error(j.error || "Failed to delete membership.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm("Are you sure you want to delete this membership plan?")) return;
    try {
      const res = await fetch(`/api/memberships/plans/${id}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (j.success) {
        toast.success(j.message || "Membership plan deleted.");
        setEditPlan(null);
        load();
      } else {
        toast.error(j.error || "Failed to delete plan.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  useEffect(() => { load(); }, [load]);

  const openModal = useCallback(() => {
    setForm(DEFAULT_FORM); setLookup(null); setErr(""); setShowModal(true);
  }, []);

  const openNewPlan = () => {
    setNewPlanForm({
      name: "",
      tier: "SILVER",
      price: "",
      validityDays: "90",
      discountPercent: "",
      benefits: [""]
    });
    setNewPlanErr("");
    setShowNewPlanModal(true);
  };

  useEffect(() => {
    setAction([
      { label: "Assign Membership", variant: "outline", onClick: openModal },
      { label: "New Membership Plan", onClick: openNewPlan },
    ]);
    return () => setAction(null);
  }, [setAction, openModal]);

  const setNewPlan = (k: keyof typeof newPlanForm, v: any) => setNewPlanForm(f => ({ ...f, [k]: v }));
  const addBenefitRow = () => setNewPlan("benefits", [...newPlanForm.benefits, ""]);
  const setBenefitRow = (i: number, v: string) => setNewPlan("benefits", newPlanForm.benefits.map((b, idx) => idx === i ? v : b));
  const removeBenefitRow = (i: number) => setNewPlan("benefits", newPlanForm.benefits.filter((_, idx) => idx !== i));

  const submitNewPlan = async () => {
    if (!newPlanForm.name.trim() || !newPlanForm.price || !newPlanForm.discountPercent) {
      setNewPlanErr("Name, price, and discount percentage are required.");
      return;
    }
    setNewPlanSubmitting(true);
    setNewPlanErr("");
    try {
      const res = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlanForm),
      });
      const j = await res.json();
      if (j.success) {
        toast.success("Membership plan created successfully!");
        setShowNewPlanModal(false);
        load();
      } else {
        setNewPlanErr(j.error || "Failed to create plan.");
      }
    } catch {
      setNewPlanErr("Network error.");
    } finally {
      setNewPlanSubmitting(false);
    }
  };

  const set = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === "phone") setLookup(null);
  };

  // Phone lookup
  const lookupCustomer = async () => {
    if (!form.phone.trim()) { setErr("Enter a phone number first."); return; }
    setLooking(true); setErr(""); setLookup(null);
    try {
      const res = await fetch("/api/memberships/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, planId: "__lookup__", startDate: form.startDate }),
      });
      const j = await res.json();
      // 404 means "no customer found", other errors surfaced
      if (res.status === 404) { setErr(j.error); }
      else if (j.success) {
        // shouldn't happen with __lookup__ planId but handle it
        setLookup({ name: j.data?.customerName ?? "Found" });
      } else {
        // If plan not found error → customer was found
        if (j.error?.includes("plan")) setLookup({ name: "Customer found" });
        else setErr(j.error);
      }
    } catch { setErr("Network error."); }
    setLooking(false);
  };

  // Actually, let's just look up via a simpler approach - do it properly
  const doLookup = async () => {
    if (!form.phone.trim()) { setErr("Enter a phone number first."); return; }
    setLooking(true); setErr(""); setLookup(null);
    try {
      const res = await fetch(`/api/customers?phone=${encodeURIComponent(form.phone.trim())}`);
      const j = await res.json();
      if (j.success && j.data?.length > 0) {
        setLookup({ name: j.data[0].name });
      } else {
        setErr("No customer found with that phone. Add them in Customers first.");
      }
    } catch { setErr("Network error."); }
    setLooking(false);
  };

  const submit = async () => {
    if (!form.phone.trim() || !form.planId || !form.startDate) {
      setErr("Phone, plan and start date are required."); return;
    }
    if (!lookup) { setErr("Please look up the customer first."); return; }
    setSubmitting(true); setErr("");
    try {
      const res = await fetch("/api/memberships/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone.trim(), planId: form.planId, startDate: form.startDate }),
      });
      const j = await res.json();
      if (j.success) { setShowModal(false); setForm(DEFAULT_FORM); setLookup(null); load(); setTab("members"); }
      else setErr(j.error || "Failed to assign.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  const openEditPlan = (p: Plan) => {
    setEditPlan(p);
    setEditForm({ price: String(p.price), validityDays: String(p.validityDays) });
  };

  const saveEditPlan = async () => {
    if (!editPlan) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/memberships/plans/${editPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: Number(editForm.price), validityDays: Number(editForm.validityDays) }),
      });
      const j = await res.json();
      if (j.success) { setEditPlan(null); load(); }
    } catch {}
    setEditSaving(false);
  };

  const activeMembers    = members.filter(m => m.status === "ACTIVE").length;
  const totalRevenue     = plans.reduce((s, p) => s + p.price * p.members, 0);
  const expiringThisMonth = members.filter(m => m.daysLeft >= 0 && m.daysLeft <= 30).length;

  return (
    <div className="px-6 space-y-6">

      {/* ── KPI chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active Members",      value: loading ? "—" : String(activeMembers),                                        desc: "Currently subscribed" },
          { label: "Membership Revenue",  value: loading ? "—" : `₹${totalRevenue.toLocaleString("en-IN")}`,                   desc: "Total from all plans" },
          { label: "Expiring This Month", value: loading ? "—" : String(expiringThisMonth),                                    desc: "Need renewal reminder" },
          { label: "Avg. Renewal Rate",   value: "82%",                                                                        desc: "Across all tiers" },
        ].map(s => (
          <div key={s.label} className="card-luxury p-4">
            <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-xs font-semibold text-foreground mt-1">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-ivory-200">
        {([["plans", "Membership Plans"], ["members", "Active Members"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === v ? "border-primary-500 text-primary-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#111111" }} />
          <p className="text-sm text-muted-foreground">Loading memberships…</p>
        </div>
      ) : (
        <>
          {/* ── Plans tab ── */}
          {tab === "plans" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map(p => {
                const s = TIER_STYLE[p.tier] ?? TIER_STYLE.SILVER;
                return (
                  <div key={p.id} className={cn("rounded-2xl p-5 border", s.bg, s.border)}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Crown className="w-6 h-6 mb-2" style={{ color: s.color }} />
                        <h3 className="text-base font-display font-bold text-foreground">{p.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Valid for {p.validity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-display font-bold" style={{ color: s.color }}>₹{p.price.toLocaleString("en-IN")}</p>
                        <p className="text-[10px] text-muted-foreground">per {p.validity}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      {p.benefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-foreground">{b}</p>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-opacity-50" style={{ borderColor: s.color + "40" }}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Active Members</span>
                        <span className="font-bold text-foreground">{p.members}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-bold text-emerald-600">{p.discount}% off services</span>
                      </div>
                    </div>
                    <button onClick={() => openEditPlan(p)} className="mt-4 w-full text-xs py-2 rounded-xl border font-medium transition-colors hover:opacity-80"
                      style={{ borderColor: s.color, color: s.color }}>Edit Plan</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Members tab ── */}
          {tab === "members" && (
            <div className="card-luxury overflow-hidden">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No memberships assigned yet. Click <strong>Assign Membership</strong> to get started.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-luxury w-full">
                    <thead>
                      <tr>
                        <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Customer</th>
                        <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Tier</th>
                        <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Start</th>
                        <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Expiry</th>
                        <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Days Left</th>
                        <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Status</th>
                        <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m, i) => {
                        const s = TIER_STYLE[m.tier] ?? TIER_STYLE.SILVER;
                        return (
                          <tr key={m.id} className={cn("border-t border-ivory-100 hover:bg-ivory-50 transition-colors", i % 2 !== 0 && "bg-ivory-50/40")}>
                            <td className="py-3 px-4">
                              <p className="text-sm font-semibold text-foreground">{m.customer}</p>
                              <p className="text-xs text-muted-foreground">{m.phone}</p>
                            </td>
                            <td className="py-3 px-4">
                              <span className={cn("badge text-[10px]", s.badge)}>
                                {m.tier.charAt(0) + m.tier.slice(1).toLowerCase()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground">{m.start}</td>
                            <td className="py-3 px-4 text-xs text-muted-foreground">{m.expiry}</td>
                            <td className="py-3 px-4">
                              <p className={cn("text-sm font-semibold",
                                m.daysLeft < 0 ? "text-red-500" : m.daysLeft <= 30 ? "text-amber-500" : "text-emerald-600"
                              )}>
                                {m.daysLeft < 0 ? "Expired" : `${m.daysLeft} days`}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span className={cn("badge text-[10px]",
                                  m.status === "ACTIVE"
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-red-100 text-red-500 border border-red-200"
                                )}>{m.status}</span>
                                {m.daysLeft >= 0 && m.daysLeft <= 30 && (
                                  <button
                                    onClick={() => {
                                      const msg = encodeURIComponent(`Hi ${m.customer}, your ${m.tier} membership at Lumi expires in ${m.daysLeft} days (${m.expiry}). Renew now to keep enjoying your exclusive benefits!`);
                                      window.open(`https://wa.me/91${m.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
                                    }}
                                    className="text-[9px] text-primary-600 underline text-left">
                                    Send renewal
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button onClick={() => deleteMember(m.id)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-all inline-flex items-center" title="Delete customer membership">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Assign Membership Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setErr(""); } }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Assign Membership</h3>
              <button onClick={() => { setShowModal(false); setErr(""); }}
                className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}

              {/* Phone lookup */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Customer Phone <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
                    placeholder="10-digit number" className={iCls + " flex-1"} />
                  <button onClick={doLookup} disabled={looking}
                    className="px-3 py-2 rounded-xl bg-ivory-100 border border-ivory-300 text-xs font-medium hover:bg-ivory-200 disabled:opacity-60 whitespace-nowrap flex items-center gap-1">
                    {looking && <Loader2 className="w-3 h-3 animate-spin" />}
                    Look up
                  </button>
                </div>
                {lookup && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Found: <strong>{lookup.name}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Membership Plan <span className="text-red-400">*</span></label>
                <select value={form.planId} onChange={e => set("planId", e.target.value)} className={iCls}>
                  <option value="">— Select a plan —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.price.toLocaleString("en-IN")} / {p.validity}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Start Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className={iCls} />
              </div>

              {form.planId && form.startDate && (
                <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200 text-xs text-muted-foreground">
                  {(() => {
                    const p = plans.find(x => x.id === form.planId);
                    if (!p) return null;
                    const exp = new Date(form.startDate);
                    exp.setDate(exp.getDate() + p.validityDays);
                    return <span>Expires: <strong className="text-foreground">{exp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong></span>;
                  })()}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => { setShowModal(false); setErr(""); }} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submit} disabled={submitting || !lookup}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Assign Membership
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Plan Modal ── */}
      {editPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setEditPlan(null); }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Edit {editPlan.name}</h3>
              <button onClick={() => setEditPlan(null)} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Price (₹)</label>
                <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} className={iCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Validity</label>
                <select value={editForm.validityDays} onChange={e => setEditForm(f => ({ ...f, validityDays: e.target.value }))} className={iCls}>
                  {VALIDITY_OPTIONS.map(o => <option key={o.days} value={o.days}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button type="button" onClick={() => deletePlan(editPlan.id)} className="btn-outline border-red-300 text-red-500 hover:bg-red-50 text-sm py-2 px-3 flex items-center justify-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete Plan
              </button>
              <div className="flex-1 flex gap-2">
                <button type="button" onClick={() => setEditPlan(null)} className="flex-1 btn-outline text-sm py-2">Cancel</button>
                <button type="button" onClick={saveEditPlan} disabled={editSaving}
                  className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                  {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Membership Plan Modal ── */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewPlanModal(false); }}>
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Create Membership Plan</h3>
              <button onClick={() => setShowNewPlanModal(false)} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {newPlanErr && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{newPlanErr}</p>}
              
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Plan Name <span className="text-red-400">*</span></label>
                <input value={newPlanForm.name} onChange={e => setNewPlan("name", e.target.value)} placeholder="e.g. Gold Membership" className={iCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Tier <span className="text-red-400">*</span></label>
                  <select value={newPlanForm.tier} onChange={e => setNewPlan("tier", e.target.value)} className={iCls}>
                    <option value="SILVER">Silver</option>
                    <option value="GOLD">Gold</option>
                    <option value="PLATINUM">Platinum</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Validity <span className="text-red-400">*</span></label>
                  <select value={newPlanForm.validityDays} onChange={e => setNewPlan("validityDays", e.target.value)} className={iCls}>
                    {VALIDITY_OPTIONS.map(o => <option key={o.days} value={o.days}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Price (₹) <span className="text-red-400">*</span></label>
                  <input type="number" value={newPlanForm.price} onChange={e => setNewPlan("price", e.target.value)} placeholder="0" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Discount % <span className="text-red-400">*</span></label>
                  <input type="number" value={newPlanForm.discountPercent} onChange={e => setNewPlan("discountPercent", e.target.value)} placeholder="15" className={iCls} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">Benefits / Included Perks</label>
                  <button onClick={addBenefitRow} className="text-[10px] text-primary-600 hover:underline">+ Add benefit</button>
                </div>
                <div className="space-y-2">
                  {newPlanForm.benefits.map((b, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={b} onChange={e => setBenefitRow(i, e.target.value)} placeholder="e.g. 10% off services" className={iCls + " flex-1"} />
                      {newPlanForm.benefits.length > 1 && (
                        <button onClick={() => removeBenefitRow(i)} className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => setShowNewPlanModal(false)} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submitNewPlan} disabled={newPlanSubmitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {newPlanSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
