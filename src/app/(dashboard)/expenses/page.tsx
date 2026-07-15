"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";

type Expense = {
  id: string; date: string; category: string;
  name: string; vendor: string; amount: number; gst: number; total: number;
  paidBy: string; notes: string;
};

const CATS: Record<string, { label: string; color: string }> = {
  RENT:          { label: "Rent",         color: "bg-purple-100 text-purple-700"  },
  SALARY:        { label: "Salary",       color: "bg-orange-100 text-orange-700"  },
  ELECTRICITY:   { label: "Electricity",  color: "bg-yellow-100 text-yellow-700"  },
  WATER:         { label: "Water",        color: "bg-cyan-100 text-cyan-700"      },
  MARKETING:     { label: "Marketing",    color: "bg-emerald-100 text-emerald-700"},
  SUPPLIES:      { label: "Supplies",     color: "bg-teal-100 text-teal-700"      },
  MAINTENANCE:   { label: "Maintenance",  color: "bg-red-100 text-red-700"        },
  EQUIPMENT:     { label: "Equipment",    color: "bg-rose-100 text-rose-700"      },
  MISCELLANEOUS: { label: "Misc",         color: "bg-gray-100 text-gray-600"      },
};

const PAY_METHODS = ["Cash","UPI","Bank Transfer","Credit Card","Debit Card","Card EMI","Auto Debit","Cheque"];
const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";
const DEFAULT_FORM = { name: "", category: "RENT", vendor: "", amount: "", gst: "", paidBy: "Cash", notes: "", date: "" };

export default function ExpensesPage() {
  const { setAction } = useHeaderAction();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [catFilter,  setCatFilter]  = useState("ALL");
  const [selected,   setSelected]   = useState<string | null>(null);
  const [showModal,  setShowModal]  = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [form,       setForm]       = useState(DEFAULT_FORM);
  const [err,        setErr]        = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipts,   setReceipts]   = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/expenses")
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setExpenses(j.data);
          setSelected(s => s ?? j.data[0]?.id ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setAction({ label: "Add Expense", onClick: () => { setEditingId(null); setForm(DEFAULT_FORM); setErr(""); setShowModal(true); } });
    return () => setAction(null);
  }, [setAction]);

  const exp = expenses.find(e => e.id === selected) ?? expenses[0] ?? null;
  const filtered = expenses.filter(e => catFilter === "ALL" || e.category === catFilter);
  const totalSpend = expenses.reduce((s, e) => s + e.total, 0);
  const totalGst   = expenses.reduce((s, e) => s + e.gst, 0);
  const topCat     = Object.entries(
    expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.total; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])[0];

  const byCategory = Object.entries(CATS)
    .map(([k, v]) => ({ ...v, cat: k, total: expenses.filter(e => e.category === k).reduce((s, e) => s + e.total, 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openEdit = (e: Expense) => {
    setForm({ name: e.name, category: e.category, vendor: e.vendor === "—" ? "" : e.vendor, amount: String(e.amount), gst: e.gst ? String(e.gst) : "", paidBy: e.paidBy, notes: e.notes, date: "" });
    setEditingId(e.id);
    setErr("");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setErr(""); setForm(DEFAULT_FORM); };

  const submit = async () => {
    if (!form.name.trim() || !form.amount) { setErr("Name and amount are required."); return; }
    setSubmitting(true);
    try {
      const url    = editingId ? `/api/expenses/${editingId}` : "/api/expenses";
      const method = editingId ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j      = await res.json();
      if (j.success) { closeModal(); load(); }
      else setErr(j.error || "Failed to save.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  const activeCats = ["ALL", ...Object.keys(CATS).filter(k => expenses.some(e => e.category === k))];

  return (
    <div className="px-6 space-y-5">

      {/* ── KPI chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Expenses",      value: loading ? "—" : `₹${Math.round(totalSpend).toLocaleString("en-IN")}`, desc: "All categories combined" },
          { label: "Biggest Category",    value: loading ? "—" : topCat ? CATS[topCat[0]]?.label ?? topCat[0] : "—",   desc: loading ? "" : topCat ? `₹${Math.round(topCat[1]).toLocaleString("en-IN")} total` : "" },
          { label: "GST Paid (Input)",    value: loading ? "—" : `₹${Math.round(totalGst).toLocaleString("en-IN")}`,   desc: "Claimable as input credit" },
          { label: "Total Entries",       value: loading ? "—" : expenses.length.toString(),                            desc: "All records" },
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
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#111111" }} />
          <p className="text-sm text-muted-foreground">Loading expenses…</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="card-luxury p-12 text-center">
          <p className="text-sm text-muted-foreground">No expenses yet. Click <strong>Add Expense</strong> to add one.</p>
        </div>
      ) : (
        <>
          {/* ── Category breakdown bar ── */}
          {byCategory.length > 0 && (
            <div className="card-luxury p-5">
              <p className="text-sm font-semibold text-foreground mb-3">Breakdown by Category</p>
              <div className="space-y-2.5">
                {byCategory.map(c => (
                  <div key={c.cat}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("badge text-[10px]", c.color)}>{c.label}</span>
                        <span className="text-xs text-muted-foreground">{((c.total / totalSpend) * 100).toFixed(1)}%</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">₹{Math.round(c.total).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-1.5 bg-ivory-200 rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width: `${(c.total / totalSpend) * 100}%`, background: "#111111" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Category filter tabs ── */}
          <div className="flex gap-1 flex-wrap">
            {activeCats.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={cn("text-xs px-3 py-1.5 rounded-lg font-medium transition-all",
                  catFilter === c ? "bg-primary-500 text-white" : "bg-white border border-ivory-300 text-muted-foreground hover:border-primary-300"
                )}>
                {c === "ALL" ? "All" : CATS[c]?.label ?? c}
              </button>
            ))}
          </div>

          {/* ── List + Detail ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 space-y-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No expenses in this category.</p>
              ) : filtered.map(e => (
                <button key={e.id} onClick={() => setSelected(e.id)}
                  className={cn("w-full text-left p-3.5 rounded-2xl border transition-all",
                    (selected ?? expenses[0]?.id) === e.id
                      ? "border-primary-300 bg-primary-50"
                      : "bg-white border-ivory-300 hover:border-primary-200"
                  )}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground truncate flex-1 mr-2">{e.name}</p>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: "#111111" }}>₹{Math.round(e.total).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("badge text-[10px]", CATS[e.category]?.color)}>{CATS[e.category]?.label ?? e.category}</span>
                    <span className="text-xs text-muted-foreground">{e.date} · {e.paidBy}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="lg:col-span-3">
              {exp ? (
                <div className="card-luxury p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={cn("badge text-[10px]", CATS[exp.category]?.color)}>{CATS[exp.category]?.label ?? exp.category}</span>
                      <span className="text-xs text-muted-foreground font-mono">{exp.id.slice(-8)}</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-2">{exp.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Vendor: {exp.vendor} · {exp.date}</p>
                  </div>

                  {exp.notes && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
                      <p className="font-semibold text-amber-600 text-[10px] uppercase tracking-wide mb-0.5">Notes</p>
                      {exp.notes}
                    </div>
                  )}

                  <div className="bg-ivory-50 rounded-xl p-4 border border-ivory-200 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Amount</span>
                      <span className="font-medium">₹{exp.amount.toLocaleString("en-IN")}</span>
                    </div>
                    {exp.gst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">GST</span>
                        <span className="font-medium">₹{exp.gst.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-ivory-300 pt-2 flex justify-between font-bold">
                      <span>Total Paid</span>
                      <span style={{ color: "#111111" }}>₹{Math.round(exp.total).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span className="font-medium">{exp.paidBy}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap items-center">
                    <button onClick={() => openEdit(exp)} className="btn-primary text-xs py-2 px-4">Edit</button>
                    <button onClick={() => fileInputRef.current?.click()} className="btn-outline text-xs py-2 px-4">Upload Receipt</button>
                    {receipts[exp.id] && <span className="text-[10px] text-emerald-600">✓ {receipts[exp.id]}</span>}
                    <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setReceipts(r => ({ ...r, [exp.id]: f.name })); e.target.value = ""; } }} />
                  </div>
                </div>
              ) : (
                <div className="card-luxury p-12 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Select an expense to view details.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">{editingId ? "Edit Expense" : "Add Expense"}</h3>
              <button onClick={closeModal} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Expense Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Monthly Internet Bill" className={iCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Category <span className="text-red-400">*</span></label>
                  <select value={form.category} onChange={e => set("category", e.target.value)} className={iCls}>
                    {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Payment Method</label>
                  <select value={form.paidBy} onChange={e => set("paidBy", e.target.value)} className={iCls}>
                    {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Vendor / Payee</label>
                <input value={form.vendor} onChange={e => set("vendor", e.target.value)} placeholder="Vendor name" className={iCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Base Amount (₹) <span className="text-red-400">*</span></label>
                  <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">GST Amount (₹)</label>
                  <input type="number" value={form.gst} onChange={e => set("gst", e.target.value)} placeholder="0" className={iCls} />
                </div>
              </div>
              {!editingId && (
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => set("date", e.target.value)} className={iCls} />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
                  placeholder="Additional details…" className={iCls + " resize-none"} />
              </div>
              {form.amount && (
                <p className="text-xs font-bold text-right" style={{ color: "#111111" }}>
                  Total: ₹{(Number(form.amount) + Number(form.gst || 0)).toLocaleString("en-IN")}
                </p>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={closeModal} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingId ? "Save Changes" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
