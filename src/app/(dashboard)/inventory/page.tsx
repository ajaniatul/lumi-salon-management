"use client";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Search, ArrowUpCircle, ArrowDownCircle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";

type Product = {
  id: string; sku: string; name: string; brand: string; categoryLabel: string;
  stock: number; minStock: number; unit: string; costPrice: number; expiry: string | null;
};

type Movement = {
  id: string; date: string; product: string; sku: string; unit: string;
  type: "IN" | "OUT"; movType: string; qty: number; before: number; after: number; reason: string;
};

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";
const DEFAULT_FORM = { productId: "", type: "IN" as "IN" | "OUT", qty: "", reason: "" };

const MOV_LABEL: Record<string, string> = {
  STOCK_IN: "Stock In", STOCK_OUT: "Stock Out", DAMAGED: "Damaged",
  ADJUSTMENT: "Adjustment", PURCHASE_RETURN: "Purchase Return", SALE_RETURN: "Sale Return",
};

export default function InventoryPage() {
  const { setAction } = useHeaderAction();

  const [tab,        setTab]        = useState<"stock" | "movements">("stock");
  const [products,   setProducts]   = useState<Product[]>([]);
  const [movements,  setMovements]  = useState<Movement[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState(DEFAULT_FORM);
  const [err,        setErr]        = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = useCallback(() =>
    fetch("/api/products?full=true").then(r => r.json()).then(j => { if (j.success) setProducts(j.data); }), []);

  const loadMovements = useCallback(() =>
    fetch("/api/inventory").then(r => r.json()).then(j => { if (j.success) setMovements(j.data); }), []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProducts(), loadMovements()]).finally(() => setLoading(false));
  }, [loadProducts, loadMovements]);

  useEffect(() => {
    setAction({ label: "Add Stock Entry", onClick: () => { setForm(DEFAULT_FORM); setErr(""); setShowModal(true); } });
    return () => setAction(null);
  }, [setAction]);

  const closeModal = () => { setShowModal(false); setErr(""); setForm(DEFAULT_FORM); };
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.productId || !form.qty || !form.reason.trim()) {
      setErr("Product, quantity and reason are required."); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${form.productId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "adjust_stock", qty: Number(form.qty), type: form.type, reason: form.reason.trim() }),
      });
      const j = await res.json();
      if (j.success) {
        closeModal();
        await Promise.all([loadProducts(), loadMovements()]);
      } else setErr(j.error || "Failed to save entry.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  const stockStatus = (p: Product) =>
    p.stock <= p.minStock ? "LOW" : p.stock <= p.minStock * 2 ? "WARNING" : "OK";

  const lowItems    = products.filter(p => stockStatus(p) !== "OK");
  const totalValue  = products.reduce((s, p) => s + p.costPrice * p.stock, 0);
  const filtered    = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === form.productId);

  return (
    <div className="space-y-5">

      {/* ── Low stock alert ── */}
      {!loading && lowItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                Action Required: {lowItems.length} product{lowItems.length > 1 ? "s" : ""} {lowItems.length === 1 ? "is" : "are"} critically low
              </p>
              {lowItems.map(p => (
                <p key={p.id} className="text-xs text-red-600 mt-0.5">
                  — <strong>{p.name}</strong> · {p.stock} {p.unit}s left (min: {p.minStock})
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Stock Value",    value: loading ? "—" : `₹${totalValue.toLocaleString("en-IN")}`,  desc: "At cost price" },
          { label: "Products Tracked",     value: loading ? "—" : products.length.toString(),                 desc: "Active SKUs" },
          { label: "Low / Critical Stock", value: loading ? "—" : lowItems.length.toString(),                 desc: "Need reorder" },
          { label: "Recent Movements",     value: loading ? "—" : movements.length.toString(),                desc: "All time records" },
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
        {([["stock", "Current Stock"], ["movements", "Movement History"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === v ? "border-primary-500 text-primary-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#B76E79" }} />
          <p className="text-sm text-muted-foreground">Loading inventory…</p>
        </div>
      ) : tab === "stock" ? (
        <div className="space-y-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or SKU…" className="input-luxury pl-9 text-sm" />
          </div>
          <div className="card-luxury overflow-hidden">
            <table className="table-luxury">
              <thead>
                <tr><th>Product</th><th>Category</th><th>Stock</th><th>Value</th><th>Expiry</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const status = stockStatus(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <p className="font-semibold text-foreground text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.brand || "—"} · {p.sku}</p>
                      </td>
                      <td><span className="badge text-[10px] bg-ivory-100 text-foreground border border-ivory-200">{p.categoryLabel}</span></td>
                      <td>
                        <p className={cn("text-sm font-bold", status === "LOW" ? "text-red-500" : status === "WARNING" ? "text-amber-500" : "text-foreground")}>
                          {p.stock} {p.unit}s
                        </p>
                        <div className="w-20 h-1.5 bg-ivory-200 rounded-full mt-1">
                          <div className="h-1.5 rounded-full" style={{
                            width: `${Math.min((p.stock / (p.minStock * 4)) * 100, 100)}%`,
                            background: status === "LOW" ? "#EF4444" : status === "WARNING" ? "#F59E0B" : "#10B981",
                          }} />
                        </div>
                      </td>
                      <td><p className="text-sm font-semibold text-foreground">₹{(p.costPrice * p.stock).toLocaleString("en-IN")}</p></td>
                      <td><p className="text-xs text-muted-foreground">{p.expiry ?? "—"}</p></td>
                      <td>
                        <span className={cn("badge text-[10px]",
                          status === "LOW"     ? "bg-red-100 text-red-700 border border-red-200" :
                          status === "WARNING" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                                 "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        )}>
                          {status === "OK" ? "In Stock" : status === "WARNING" ? "Running Low" : "Critical"}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => { setForm({ productId: p.id, type: "IN", qty: "", reason: "" }); setErr(""); setShowModal(true); }}
                          className="text-xs px-2.5 py-1 rounded-lg border border-ivory-300 text-muted-foreground hover:bg-ivory-100">
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card-luxury overflow-hidden">
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No stock movements recorded yet.</p>
          ) : (
            <table className="table-luxury">
              <thead>
                <tr><th>Date</th><th>Product</th><th>Type</th><th>Qty Changed</th><th>Before / After</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td><p className="text-xs text-muted-foreground">{m.date}</p></td>
                    <td>
                      <p className="text-sm font-medium text-foreground">{m.product}</p>
                      <p className="text-[10px] text-muted-foreground">{m.sku}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {m.type === "IN"
                          ? <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500" />
                          : <ArrowDownCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={cn("badge text-[10px]", m.type === "IN" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                          {MOV_LABEL[m.movType] ?? m.movType}
                        </span>
                      </div>
                    </td>
                    <td>
                      <p className={cn("text-sm font-bold", m.type === "IN" ? "text-emerald-600" : "text-red-500")}>
                        {m.type === "IN" ? "+" : "-"}{m.qty} {m.unit}s
                      </p>
                    </td>
                    <td><p className="text-xs text-muted-foreground">{m.before} → {m.after}</p></td>
                    <td><p className="text-xs text-muted-foreground">{m.reason}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Add Stock Entry Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Add Stock Entry</h3>
              <button onClick={closeModal} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Product <span className="text-red-400">*</span></label>
                <select value={form.productId} onChange={e => set("productId", e.target.value)} className={iCls}>
                  <option value="">Select product…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (stock: {p.stock} {p.unit}s)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Movement Type <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  {([["IN", "Stock In — Add stock"], ["OUT", "Stock Out — Remove / Use"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => set("type", v)}
                      className={cn("flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
                        form.type === v
                          ? v === "IN" ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-red-50 text-red-600 border-red-300"
                          : "bg-white border-ivory-300 text-muted-foreground hover:border-primary-200"
                      )}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Quantity <span className="text-red-400">*</span></label>
                <input type="number" min="1" value={form.qty} onChange={e => set("qty", e.target.value)}
                  placeholder="Number of units" className={iCls} />
              </div>
              {selectedProduct && form.qty && (
                <p className="text-xs text-muted-foreground bg-ivory-50 px-3 py-2 rounded-xl border border-ivory-200">
                  New stock: <strong className="text-foreground">
                    {Math.max(0, form.type === "IN"
                      ? selectedProduct.stock + Number(form.qty)
                      : selectedProduct.stock - Number(form.qty)
                    )} {selectedProduct.unit}s
                  </strong>
                </p>
              )}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Reason / Reference <span className="text-red-400">*</span></label>
                <input value={form.reason} onChange={e => set("reason", e.target.value)}
                  placeholder="e.g. Monthly restock / Used for service" className={iCls} />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={closeModal} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving…" : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
