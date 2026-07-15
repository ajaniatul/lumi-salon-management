"use client";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, X, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";

type Pkg = {
  id: string; name: string; desc: string; category: string;
  services: string[]; validity: string; validityDays: number;
  originalPrice: number | null; packagePrice: number; savings: number;
  activePurchases: number;
};

type CustomerPkg = {
  id: string; customer: string; phone: string; pkg: string; pkgId: string;
  purchased: string; expiry: string;
  sessionsUsed: number; sessionsTotal: number; remaining: number;
};

const CATS = ["Hair", "Skin", "Nails", "Bridal", "Wellness", "Body"];
const VALIDITY_OPTS = ["1 month", "2 months", "3 months", "4 months", "6 months", "6 weeks", "12 months"];

const CAT_COLORS: Record<string, string> = {
  Hair:    "bg-violet-100 text-violet-700",
  Skin:    "bg-rose-100 text-rose-700",
  Nails:   "bg-pink-100 text-pink-700",
  Bridal:  "bg-amber-100 text-amber-700",
  Wellness:"bg-emerald-100 text-emerald-700",
  Body:    "bg-blue-100 text-blue-700",
};

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";
const DEFAULT_FORM = { name: "", category: "Hair", desc: "", services: [""], validity: "3 months", originalPrice: "", packagePrice: "" };
const DEFAULT_ASSIGN = { phone: "", packageId: "", purchaseDate: new Date().toISOString().slice(0, 10) };

export default function PackagesPage() {
  const { setAction } = useHeaderAction();

  const [packages,     setPackages]     = useState<Pkg[]>([]);
  const [customerPkgs, setCustomerPkgs] = useState<CustomerPkg[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [custLoading,  setCustLoading]  = useState(true);
  const [tab,          setTab]          = useState<"packages" | "customers">("packages");
  const [selected,     setSelected]     = useState<string | null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [showAssign,   setShowAssign]   = useState(false);
  const [preselPkgId,  setPreselPkgId] = useState<string | null>(null);
  const [form,         setForm]         = useState(DEFAULT_FORM);
  const [assignForm,   setAssignForm]   = useState(DEFAULT_ASSIGN);
  const [lookup,       setLookup]       = useState<{ name: string } | null>(null);
  const [looking,      setLooking]      = useState(false);
  const [err,          setErr]          = useState("");
  const [submitting,   setSubmitting]   = useState(false);

  const loadPackages = useCallback(() => {
    setLoading(true);
    fetch("/api/packages").then(r => r.json()).then(j => {
      if (j.success) { setPackages(j.data); if (!selected) setSelected(j.data[0]?.id ?? null); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selected]);

  const loadCustomers = useCallback(() => {
    setCustLoading(true);
    fetch("/api/packages/customers").then(r => r.json()).then(j => {
      if (j.success) setCustomerPkgs(j.data);
    }).catch(() => {}).finally(() => setCustLoading(false));
  }, []);

  useEffect(() => { loadPackages(); loadCustomers(); }, []);

  const openNewModal = useCallback(() => {
    setEditingId(null); setForm(DEFAULT_FORM); setErr(""); setShowModal(true);
  }, []);

  const openAssignModal = useCallback(() => {
    setAssignForm(DEFAULT_ASSIGN); setLookup(null); setErr(""); setShowAssign(true);
  }, []);

  useEffect(() => {
    setAction([
      { label: "Assign to Customer", variant: "outline", onClick: openAssignModal },
      { label: "New Package",        onClick: openNewModal },
    ]);
    return () => setAction(null);
  }, [setAction, openNewModal, openAssignModal]);

  const pkg = packages.find(p => p.id === (selected ?? packages[0]?.id)) ?? packages[0] ?? null;

  const set = (k: keyof typeof form, v: string | string[]) => setForm(f => ({ ...f, [k]: v }));
  const addRow    = () => set("services", [...form.services, ""]);
  const setRow    = (i: number, v: string) => set("services", form.services.map((s, idx) => idx === i ? v : s));
  const removeRow = (i: number) => set("services", form.services.filter((_, idx) => idx !== i));

  const openEdit = (p: Pkg) => {
    setForm({ name: p.name, category: p.category, desc: p.desc, services: p.services.length ? [...p.services] : [""], validity: p.validity, originalPrice: p.originalPrice ? String(p.originalPrice) : "", packagePrice: String(p.packagePrice) });
    setEditingId(p.id); setErr(""); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setErr(""); setForm(DEFAULT_FORM); };

  const submit = async () => {
    const svcs = form.services.filter(s => s.trim());
    if (!form.name.trim() || !form.packagePrice || svcs.length === 0) {
      setErr("Name, price and at least one service are required."); return;
    }
    setSubmitting(true); setErr("");
    try {
      const url    = editingId ? `/api/packages/${editingId}` : "/api/packages";
      const method = editingId ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, services: svcs }) });
      const j      = await res.json();
      if (j.success) { closeModal(); loadPackages(); }
      else setErr(j.error || "Failed to save.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  const doLookup = async () => {
    if (!assignForm.phone.trim()) { setErr("Enter a phone number first."); return; }
    setLooking(true); setErr(""); setLookup(null);
    try {
      const res = await fetch(`/api/customers?phone=${encodeURIComponent(assignForm.phone.trim())}`);
      const j   = await res.json();
      if (j.success && j.data?.length > 0) setLookup({ name: j.data[0].name });
      else setErr("No customer with that phone. Add them in Customers first.");
    } catch { setErr("Network error."); }
    setLooking(false);
  };

  const submitAssign = async () => {
    if (!assignForm.phone.trim() || !assignForm.packageId || !assignForm.purchaseDate) {
      setErr("All fields are required."); return;
    }
    if (!lookup) { setErr("Look up the customer first."); return; }
    setSubmitting(true); setErr("");
    try {
      const res = await fetch("/api/packages/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: assignForm.phone, packageId: assignForm.packageId, purchaseDate: assignForm.purchaseDate }) });
      const j   = await res.json();
      if (j.success) { setShowAssign(false); setAssignForm(DEFAULT_ASSIGN); setLookup(null); loadPackages(); loadCustomers(); setTab("customers"); }
      else setErr(j.error || "Failed to assign.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  const redeem = async (cpId: string) => {
    const res = await fetch(`/api/packages/customers/${cpId}/redeem`, { method: "POST" });
    const j   = await res.json();
    if (j.success) loadCustomers();
  };

  const totalSold = packages.reduce((s, p) => s + p.activePurchases, 0);
  const topPkg    = [...packages].sort((a, b) => b.activePurchases - a.activePurchases)[0];

  return (
    <div className="px-6 space-y-6">

      {/* ── KPI chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Packages",  value: loading ? "—" : String(packages.length),     desc: "Active bundles" },
          { label: "Packages Sold",   value: loading ? "—" : String(totalSold),            desc: "Across all customers" },
          { label: "Most Popular",    value: loading || !topPkg ? "—" : topPkg.name.split(" ")[0] + "…", desc: loading || !topPkg ? "" : `${topPkg.activePurchases} customers` },
          { label: "Avg. Savings",    value: loading || !packages.length ? "—" : `₹${Math.round(packages.filter(p => p.savings > 0).reduce((s, p) => s + p.savings, 0) / (packages.filter(p => p.savings > 0).length || 1)).toLocaleString("en-IN")}`, desc: "vs individual pricing" },
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
        {([["packages", "Package Catalogue"], ["customers", "Customer Packages"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === v ? "border-primary-500 text-primary-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#111111" }} />
          <p className="text-sm text-muted-foreground">Loading packages…</p>
        </div>
      ) : (
        <>
          {/* ── Package Catalogue ── */}
          {tab === "packages" && (
            packages.length === 0 ? (
              <div className="card-luxury p-12 text-center">
                <p className="text-sm text-muted-foreground">No packages yet. Click <strong>New Package</strong> to create one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* List */}
                <div className="lg:col-span-1 space-y-2">
                  {packages.map(p => (
                    <button key={p.id} onClick={() => setSelected(p.id)}
                      className={cn("w-full text-left p-3.5 rounded-2xl border transition-all",
                        (selected ?? packages[0]?.id) === p.id
                          ? "border-primary-300 bg-primary-50"
                          : "bg-white border-ivory-300 hover:border-primary-200"
                      )}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("badge text-[10px]", CAT_COLORS[p.category] ?? "bg-gray-100 text-gray-600")}>{p.category}</span>
                            <span className="text-xs text-muted-foreground">{p.services.length} sessions</span>
                          </div>
                        </div>
                        <p className="text-sm font-bold" style={{ color: "#111111" }}>₹{p.packagePrice.toLocaleString("en-IN")}</p>
                      </div>
                      {p.savings > 0 && <p className="text-xs text-emerald-600 mt-1">Save ₹{p.savings.toLocaleString("en-IN")} vs individual</p>}
                    </button>
                  ))}
                </div>

                {/* Detail */}
                {pkg && (
                  <div className="lg:col-span-2">
                    <div className="card-luxury p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("badge text-[10px]", CAT_COLORS[pkg.category] ?? "bg-gray-100 text-gray-600")}>{pkg.category}</span>
                            <span className="text-xs text-muted-foreground font-mono">{pkg.id.slice(-8)}</span>
                          </div>
                          <h3 className="text-base font-bold text-foreground">{pkg.name}</h3>
                        </div>
                        <button onClick={() => openEdit(pkg)} className="btn-outline text-xs py-1.5 px-3">Edit</button>
                      </div>
                      {pkg.desc && <p className="text-sm text-muted-foreground leading-relaxed">{pkg.desc}</p>}
                      {pkg.services.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">Included Services ({pkg.services.length} sessions)</p>
                          <div className="space-y-2">
                            {pkg.services.map((s, i) => (
                              <div key={i} className="flex items-start gap-2.5 p-3 bg-ivory-50 rounded-xl border border-ivory-200">
                                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-foreground">{s}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="bg-ivory-50 rounded-xl p-4 border border-ivory-200 space-y-2">
                        {pkg.originalPrice && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">If booked individually</span>
                            <span className="line-through text-muted-foreground">₹{pkg.originalPrice.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Package Price</span>
                          <span className="font-bold" style={{ color: "#111111" }}>₹{pkg.packagePrice.toLocaleString("en-IN")}</span>
                        </div>
                        {pkg.savings > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Customer Savings</span>
                            <span className="text-emerald-600 font-semibold">₹{pkg.savings.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs border-t border-ivory-300 pt-2">
                          <span className="text-muted-foreground">Validity</span>
                          <span className="font-medium">{pkg.validity}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Active Purchases</span>
                          <span className="font-medium">{pkg.activePurchases} customers</span>
                        </div>
                      </div>
                      <button onClick={() => { setAssignForm({ ...DEFAULT_ASSIGN, packageId: pkg.id }); setLookup(null); setErr(""); setShowAssign(true); }}
                        className="btn-primary text-xs py-2 px-4">Assign to Customer</button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* ── Customer Packages ── */}
          {tab === "customers" && (
            custLoading ? (
              <div className="flex items-center justify-center h-32 gap-3">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#111111" }} />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : customerPkgs.length === 0 ? (
              <div className="card-luxury p-12 text-center">
                <p className="text-sm text-muted-foreground">No packages assigned yet. Use <strong>Assign to Customer</strong> to get started.</p>
              </div>
            ) : (
              <div className="card-luxury overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table-luxury w-full">
                    <thead>
                      <tr>
                        {["Customer", "Package", "Purchased", "Expiry", "Progress", "Remaining", "Action"].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customerPkgs.map((cp, i) => (
                        <tr key={cp.id} className={cn("border-t border-ivory-100 hover:bg-ivory-50 transition-colors", i % 2 !== 0 && "bg-ivory-50/40")}>
                          <td className="py-3 px-4">
                            <p className="text-sm font-semibold text-foreground">{cp.customer}</p>
                            <p className="text-xs text-muted-foreground">{cp.phone}</p>
                          </td>
                          <td className="py-3 px-4 text-sm text-foreground max-w-[180px]">{cp.pkg}</td>
                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{cp.purchased}</td>
                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{cp.expiry}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-ivory-200 rounded-full">
                                <div className="h-2 rounded-full" style={{ width: `${(cp.sessionsUsed / cp.sessionsTotal) * 100}%`, background: "#111111" }} />
                              </div>
                              <p className="text-xs text-muted-foreground">{cp.sessionsUsed}/{cp.sessionsTotal}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-sm font-bold" style={{ color: "#111111" }}>
                              {cp.remaining} session{cp.remaining !== 1 ? "s" : ""}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            {cp.remaining > 0
                              ? <button onClick={() => redeem(cp.id)} className="text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-200 font-medium hover:bg-primary-100 transition-colors">Redeem</button>
                              : <span className="text-xs text-muted-foreground">Completed</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* ── New / Edit Package Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">{editingId ? "Edit Package" : "New Service Package"}</h3>
              <button onClick={closeModal} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Package Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Glow & Shine Combo" className={iCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Category</label>
                  <select value={form.category} onChange={e => set("category", e.target.value)} className={iCls}>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Validity</label>
                  <select value={form.validity} onChange={e => set("validity", e.target.value)} className={iCls}>
                    {VALIDITY_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Description</label>
                <textarea value={form.desc} onChange={e => set("desc", e.target.value)} rows={2} placeholder="Brief description…" className={iCls + " resize-none"} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">Included Services <span className="text-red-400">*</span></label>
                  <button onClick={addRow} className="text-xs text-primary-600 underline">+ Add row</button>
                </div>
                <div className="space-y-2">
                  {form.services.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={s} onChange={e => setRow(i, e.target.value)} placeholder={`Service ${i + 1}`} className={iCls} />
                      {form.services.length > 1 && (
                        <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-red-500 flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Original Price (₹)</label>
                  <input type="number" value={form.originalPrice} onChange={e => set("originalPrice", e.target.value)} placeholder="Individual total" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Package Price (₹) <span className="text-red-400">*</span></label>
                  <input type="number" value={form.packagePrice} onChange={e => set("packagePrice", e.target.value)} placeholder="Discounted price" className={iCls} />
                </div>
              </div>
              {form.originalPrice && form.packagePrice && Number(form.originalPrice) > Number(form.packagePrice) && (
                <p className="text-xs text-emerald-600 font-medium text-right">
                  Customer saves ₹{(Number(form.originalPrice) - Number(form.packagePrice)).toLocaleString("en-IN")}
                </p>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={closeModal} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingId ? "Save Changes" : "Create Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign to Customer Modal ── */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAssign(false); setErr(""); } }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Assign Package to Customer</h3>
              <button onClick={() => { setShowAssign(false); setErr(""); }}
                className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Customer Phone <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  <input type="tel" value={assignForm.phone}
                    onChange={e => { setAssignForm(f => ({ ...f, phone: e.target.value })); setLookup(null); }}
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
                <label className="text-xs font-semibold text-foreground block mb-1">Package <span className="text-red-400">*</span></label>
                <select value={assignForm.packageId} onChange={e => setAssignForm(f => ({ ...f, packageId: e.target.value }))} className={iCls}>
                  <option value="">— Select a package —</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.packagePrice.toLocaleString("en-IN")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Purchase Date <span className="text-red-400">*</span></label>
                <input type="date" value={assignForm.purchaseDate} onChange={e => setAssignForm(f => ({ ...f, purchaseDate: e.target.value }))} className={iCls} />
              </div>
              {assignForm.packageId && assignForm.purchaseDate && (
                <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200 text-xs text-muted-foreground">
                  {(() => {
                    const p = packages.find(x => x.id === assignForm.packageId);
                    if (!p) return null;
                    const exp = new Date(assignForm.purchaseDate);
                    exp.setDate(exp.getDate() + p.validityDays);
                    return <span>Expires: <strong className="text-foreground">{exp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong> · {p.services.length} sessions</span>;
                  })()}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => { setShowAssign(false); setErr(""); }} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submitAssign} disabled={submitting || !lookup}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Assign Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
