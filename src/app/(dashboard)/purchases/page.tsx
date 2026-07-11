"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, FileText, X, Loader2 } from "lucide-react";
import { InvoiceA4, InvoiceData } from "@/components/InvoiceA4";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";

type PurchaseItem = { id: string; name: string; qty: number; cost: number; gst: number; total: number; };
type Purchase = {
  id: string; purchaseNumber: string; supplier: string; invoice: string; date: string;
  subtotal: number; gst: number; total: number; paid: number; due: number;
  status: "PAID" | "PARTIAL" | "PENDING"; notes: string; items: PurchaseItem[];
};

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";
const DEFAULT_ITEM = { name: "", qty: "", cost: "", gst: "18" };
const DEFAULT_FORM = { supplier: "", invoice: "", notes: "", items: [{ ...DEFAULT_ITEM }] };

const STATUS_STYLE: Record<string, string> = {
  PAID:    "bg-emerald-100 text-emerald-700 border border-emerald-200",
  PARTIAL: "bg-blue-100 text-blue-700 border border-blue-200",
  PENDING: "bg-amber-100 text-amber-700 border border-amber-200",
};
const STATUS_LABEL: Record<string, string> = { PAID: "Fully Paid", PARTIAL: "Partial Payment", PENDING: "Awaiting Payment" };
const STATUS_BADGE: Record<string, string> = { PAID: "Paid", PARTIAL: "Partial", PENDING: "Pending" };

export default function PurchasesPage() {
  const { setAction } = useHeaderAction();

  const [purchases,   setPurchases]   = useState<Purchase[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState<string | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [showA4,      setShowA4]      = useState(false);
  const [showPayModal,setShowPayModal]= useState(false);
  const [payForm,     setPayForm]     = useState({ amount: "", method: "Cash" });
  const [form,        setForm]        = useState(DEFAULT_FORM);
  const [err,         setErr]         = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/purchases")
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setPurchases(j.data);
          setSelected(s => s ?? j.data[0]?.id ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setAction({ label: "New Purchase Entry", onClick: () => { setForm(DEFAULT_FORM); setErr(""); setShowModal(true); } });
    return () => setAction(null);
  }, [setAction]);

  const purch = purchases.find(p => p.id === selected) ?? purchases[0] ?? null;

  const filtered = purchases.filter(p =>
    p.supplier.toLowerCase().includes(search.toLowerCase()) ||
    p.purchaseNumber.includes(search) || p.invoice.includes(search)
  );

  const totalPurchased = purchases.reduce((s, p) => s + p.total, 0);
  const totalDue       = purchases.reduce((s, p) => s + p.due, 0);

  /* ── Form helpers ── */
  const setItem = (i: number, k: string, v: string) =>
    setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { ...DEFAULT_ITEM }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  /* ── Modal item totals preview ── */
  const liveTotal = form.items.reduce((s, it) => {
    const qty = Number(it.qty) || 0;
    const cost = Number(it.cost) || 0;
    const gst  = Number(it.gst) || 0;
    return s + Math.round(qty * cost * (1 + gst / 100) * 100) / 100;
  }, 0);

  /* ── Submit new purchase ── */
  const submit = async () => {
    if (!form.supplier.trim() || !form.items.some(it => it.name.trim())) {
      setErr("Supplier name and at least one item are required."); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/purchases", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const j = await res.json();
      if (j.success) { setShowModal(false); setForm(DEFAULT_FORM); setErr(""); load(); }
      else setErr(j.error || "Failed to save.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  /* ── Record payment ── */
  const recordPayment = async () => {
    if (!purch || !payForm.amount) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/purchases/${purch.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount: Number(payForm.amount) }),
      });
      const j = await res.json();
      if (j.success) {
        const newPaid = j.data.paidAmount;
        setPurchases(ps => ps.map(p => {
          if (p.id !== purch.id) return p;
          const due = Math.max(0, p.total - newPaid);
          return { ...p, paid: newPaid, due, status: due === 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING" };
        }));
        setShowPayModal(false);
        setPayForm({ amount: "", method: "Cash" });
      }
    } catch {}
    setSubmitting(false);
  };

  /* ── Invoice A4 data ── */
  const purchA4Data = (): InvoiceData | null => {
    if (!purch) return null;
    return {
      invoiceNo:  purch.purchaseNumber,
      date:       purch.date,
      customer:   purch.supplier,
      items:      purch.items.map(it => ({ description: it.name, type: "Product" as const, hsnCode: "3305", amount: it.total, detail: `Qty: ${it.qty} × ₹${it.cost}` })),
      subtotal:   purch.subtotal,
      cgst:       Math.round(purch.gst / 2),
      sgst:       Math.round(purch.gst / 2),
      halfGst:    9,
      total:      Math.round(purch.total),
      payMethod:  purch.status === "PAID" ? "Paid" : "Pending",
      status:     purch.status as "PAID" | "PARTIAL" | "PENDING",
    };
  };

  return (
    <div className="px-6 space-y-5">

      {/* ── KPI chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Purchased",        value: loading ? "—" : `₹${Math.round(totalPurchased).toLocaleString("en-IN")}`, desc: "All supplier orders" },
          { label: "Amount Paid",            value: loading ? "—" : `₹${Math.round(totalPurchased - totalDue).toLocaleString("en-IN")}`, desc: "Cleared to suppliers" },
          { label: "Outstanding to Vendors", value: loading ? "—" : `₹${Math.round(totalDue).toLocaleString("en-IN")}`, desc: "Pending payments" },
          { label: "Purchase Orders",        value: loading ? "—" : purchases.length.toString(), desc: "Total records" },
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
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#B76E79" }} />
          <p className="text-sm text-muted-foreground">Loading purchases…</p>
        </div>
      ) : purchases.length === 0 ? (
        <div className="card-luxury p-12 text-center">
          <p className="text-sm text-muted-foreground">No purchases yet. Click <strong>New Purchase Entry</strong> to add one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Left: list ── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search supplier or invoice…" className="input-luxury pl-9 text-sm" />
            </div>
            <div className="space-y-2">
              {filtered.map(p => (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={cn("w-full text-left p-3.5 rounded-2xl border transition-all",
                    (selected ?? purchases[0]?.id) === p.id
                      ? "border-primary-300 bg-primary-50"
                      : "bg-white border-ivory-300 hover:border-primary-200"
                  )}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground truncate flex-1 mr-2">{p.supplier}</p>
                    <span className={cn("badge text-[10px] flex-shrink-0",
                      p.status === "PAID"    ? "bg-emerald-100 text-emerald-700" :
                      p.status === "PARTIAL" ? "bg-blue-100 text-blue-700" :
                                               "bg-amber-100 text-amber-700"
                    )}>{STATUS_BADGE[p.status]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.purchaseNumber} · {p.date}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{p.items.length} item{p.items.length > 1 ? "s" : ""}</p>
                    <p className="text-sm font-bold" style={{ color: "#B76E79" }}>₹{Math.round(p.total).toLocaleString("en-IN")}</p>
                  </div>
                  {p.due > 0 && <p className="text-xs text-red-500 mt-1">Due: ₹{Math.round(p.due).toLocaleString("en-IN")}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: detail ── */}
          {purch && (
            <div className="lg:col-span-3">
              <div className="card-luxury p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Purchase Order</p>
                    <h3 className="text-base font-bold text-foreground mt-0.5">{purch.purchaseNumber}</h3>
                    <p className="text-xs text-muted-foreground">{purch.date} · Invoice: {purch.invoice}</p>
                  </div>
                  <span className={cn("badge text-xs", STATUS_STYLE[purch.status])}>
                    {STATUS_LABEL[purch.status]}
                  </span>
                </div>

                <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Supplier</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{purch.supplier}</p>
                </div>

                {purch.notes && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
                    <p className="font-semibold text-amber-600 text-[10px] mb-0.5">Notes</p>{purch.notes}
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">Items Purchased</p>
                  <div className="space-y-2">
                    {purch.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between p-3 bg-ivory-50 rounded-xl border border-ivory-200">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Qty: {item.qty} · Cost: ₹{item.cost} · GST: {item.gst}%
                          </p>
                        </div>
                        <p className="text-sm font-bold text-foreground">₹{item.total.toLocaleString("en-IN")}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-ivory-50 rounded-xl p-4 border border-ivory-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{purch.subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST (Input Tax Credit)</span>
                    <span>₹{Math.round(purch.gst).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="border-t border-ivory-300 pt-2 flex justify-between font-bold">
                    <span>Total Invoice</span>
                    <span style={{ color: "#B76E79" }}>₹{Math.round(purch.total).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600">Amount Paid</span>
                    <span className="text-emerald-600 font-medium">₹{purch.paid.toLocaleString("en-IN")}</span>
                  </div>
                  {purch.due > 0 && (
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-red-500">Balance Due</span>
                      <span className="text-red-500">₹{Math.round(purch.due).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setShowA4(true)}
                    className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> View Invoice
                  </button>
                  {purch.due > 0 && (
                    <button onClick={() => { setPayForm({ amount: String(Math.round(purch.due)), method: "Cash" }); setShowPayModal(true); }}
                      className="btn-outline text-xs py-2 px-4">
                      Record Payment
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── New Purchase Entry Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setErr(""); setForm(DEFAULT_FORM); } }}>
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">New Purchase Entry</h3>
              <button onClick={() => { setShowModal(false); setErr(""); setForm(DEFAULT_FORM); }}
                className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Supplier Name <span className="text-red-400">*</span></label>
                  <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                    placeholder="e.g. Beauty Pro Distributors" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Supplier Invoice #</label>
                  <input value={form.invoice} onChange={e => setForm(f => ({ ...f, invoice: e.target.value }))}
                    placeholder="Invoice reference" className={iCls} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-foreground">Items Purchased <span className="text-red-400">*</span></label>
                  <button onClick={addItem} className="text-xs text-primary-600 underline">+ Add item</button>
                </div>
                <div className="space-y-2">
                  {form.items.map((it, i) => (
                    <div key={i} className="p-3 bg-ivory-50 rounded-xl border border-ivory-200 space-y-2">
                      <div className="flex gap-2">
                        <input value={it.name} onChange={e => setItem(i, "name", e.target.value)}
                          placeholder="Product name" className={iCls} />
                        {form.items.length > 1 && (
                          <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-red-500 flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Qty</label>
                          <input type="number" min="1" value={it.qty} onChange={e => setItem(i, "qty", e.target.value)} placeholder="1" className={iCls} />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Unit Cost (₹)</label>
                          <input type="number" value={it.cost} onChange={e => setItem(i, "cost", e.target.value)} placeholder="0" className={iCls} />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">GST %</label>
                          <select value={it.gst} onChange={e => setItem(i, "gst", e.target.value)} className={iCls}>
                            {["0", "5", "12", "18", "28"].map(g => <option key={g} value={g}>{g}%</option>)}
                          </select>
                        </div>
                      </div>
                      {it.qty && it.cost && (
                        <p className="text-[10px] text-muted-foreground text-right">
                          Line total: ₹{Math.round(Number(it.qty) * Number(it.cost) * (1 + Number(it.gst) / 100)).toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {liveTotal > 0 && (
                  <p className="text-xs font-bold text-right mt-2" style={{ color: "#B76E79" }}>
                    Grand Total: ₹{Math.round(liveTotal).toLocaleString("en-IN")}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Purchase notes, conditions…" className={iCls + " resize-none"} />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => { setShowModal(false); setErr(""); setForm(DEFAULT_FORM); }}
                className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving…" : "Save Purchase"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {showPayModal && purch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowPayModal(false); }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Record Payment — {purch.supplier}</h3>
              <button onClick={() => setShowPayModal(false)} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">Balance due: <strong className="text-foreground">₹{Math.round(purch.due).toLocaleString("en-IN")}</strong></p>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Amount Paid (₹)</label>
                <input type="number" value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  max={purch.due} className={iCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Payment Method</label>
                <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} className={iCls}>
                  {["Cash", "UPI", "Bank Transfer", "Cheque", "Card"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => setShowPayModal(false)} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={recordPayment} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving…" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showA4 && purch && purchA4Data() && <InvoiceA4 data={purchA4Data()!} onClose={() => setShowA4(false)} />}
    </div>
  );
}
