"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, X, Loader2, Trash2, Camera, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";
import toast from "react-hot-toast";
import BarcodeScanner from "@/components/BarcodeScanner";

type Product = {
  id: string; sku: string; name: string; brand: string; barcode: string | null;
  category: string; categoryLabel: string;
  price: number; costPrice: number; mrp: number | null;
  gst: number; hsn: string;
  stock: number; minStock: number; unit: string;
  mfgDate: string | null; expiry: string | null; isForSale: boolean; isForUse: boolean; isActive: boolean;
};

const DEFAULT_PROD_CATS = [
  { value: "HAIR_CARE",    label: "Hair Care"    },
  { value: "SKIN_CARE",    label: "Skin Care"    },
  { value: "NAIL_CARE",    label: "Nail Care"    },
  { value: "MAKEUP",       label: "Makeup"       },
  { value: "TOOLS",        label: "Tools"        },
  { value: "ACCESSORIES",  label: "Accessories"  },
  { value: "CONSUMABLES",  label: "Consumables"  },
];
function makeCats(raw: string[]) {
  return raw.map(v => ({
    value: v,
    label: v.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
  }));
}
const UNITS = ["piece","bottle","tube","kit","jar","tin","pack","box","kg","litre","ml","g"];

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";
const DEFAULT_FORM = { name:"", brand:"", barcode:"", category:"HAIR_CARE", price:"", costPrice:"", mrp:"", stock:"", minStock:"5", unit:"piece", mfgDate:"", expiry:"", isForSale:true, gst:"18", hsn:"3305" };

export default function ProductsPage() {
  const { setAction } = useHeaderAction();

  const [products,       setProducts]       = useState<Product[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [catFilter,      setCatFilter]      = useState("ALL");
  const [selected,       setSelected]       = useState<string | null>(null);
  const [showModal,      setShowModal]      = useState(false);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockAdj,       setStockAdj]       = useState({ type: "IN" as "IN" | "OUT", qty: "", reason: "" });
  const [form,           setForm]           = useState(DEFAULT_FORM);
  const [err,            setErr]            = useState("");
  const [submitting,     setSubmitting]     = useState(false);
  const [categories,     setCategories]     = useState(makeCats(DEFAULT_PROD_CATS.map(c => c.value)));
  const [showScanner,    setShowScanner]    = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/products?full=true").then(r => r.json()),
      fetch("/api/settings").then(r => r.json()),
    ]).then(([prod, set]) => {
      if (prod.success) setProducts(prod.data);
      if (set.success && set.data?.productCategories?.length) setCategories(makeCats(set.data.productCategories));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Register header button
  useEffect(() => {
    setAction({ label: "Add Product", onClick: () => { setEditingId(null); setForm(DEFAULT_FORM); setErr(""); setShowModal(true); } });
    return () => setAction(null);
  }, [setAction]);

  const prod = products.find(p => p.id === selected) ?? products[0] ?? null;

  const openEdit = (p: Product) => {
    setForm({ name: p.name, brand: p.brand, barcode: p.barcode ?? "", category: p.category, price: String(p.price), costPrice: String(p.costPrice), mrp: p.mrp ? String(p.mrp) : "", stock: String(p.stock), minStock: String(p.minStock), unit: p.unit, mfgDate: p.mfgDate ?? "", expiry: p.expiry ?? "", isForSale: p.isForSale, gst: String(p.gst), hsn: p.hsn });
    setEditingId(p.id);
    setErr("");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setErr(""); setForm(DEFAULT_FORM); };

  const deleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (j.success) {
        toast.success(j.message || "Product deleted successfully.");
        setSelected(null);
        closeModal();
        load();
      } else {
        toast.error(j.error || "Failed to delete product.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.category || !form.price) {
      setErr("Name, category and price are required."); return;
    }
    setSubmitting(true);
    try {
      const body = { name: form.name, brand: form.brand, barcode: form.barcode || null, category: form.category, price: Number(form.price), costPrice: Number(form.costPrice) || 0, mrp: form.mrp ? Number(form.mrp) : null, stock: Number(form.stock) || 0, minStock: Number(form.minStock) || 5, unit: form.unit, mfgDate: form.mfgDate || null, expiry: form.expiry || null, isForSale: form.isForSale, gst: Number(form.gst) || 18, hsn: form.hsn };
      const url    = editingId ? `/api/products/${editingId}` : "/api/products";
      const method = editingId ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j      = await res.json();
      if (j.success) { closeModal(); load(); }
      else setErr(j.error || "Failed to save product.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  const submitStock = async () => {
    if (!prod || !stockAdj.qty || Number(stockAdj.qty) <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "adjust_stock", qty: Number(stockAdj.qty), type: stockAdj.type, reason: stockAdj.reason }),
      });
      const j = await res.json();
      if (j.success) {
        setProducts(ps => ps.map(p => p.id === prod.id ? { ...p, stock: j.data.stock } : p));
        setShowStockModal(false);
        setStockAdj({ type: "IN", qty: "", reason: "" });
      }
    } catch {}
    setSubmitting(false);
  };

  const filtered = products.filter(p => {
    const q = search.trim().toLowerCase();
    return (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
        && (catFilter === "ALL" || p.category === catFilter);
  });

  const activeCats = ["ALL", ...categories.filter(c => products.some(p => p.category === c.value)).map(c => c.value)];

  const totalValue    = products.reduce((s, p) => s + p.price * p.stock, 0);
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  return (
    <div className="px-6 space-y-5">

      {/* ── KPI chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Products",     value: loading ? "—" : products.length.toString(),                desc: "Active SKUs in catalog" },
          { label: "Available for Sale", value: loading ? "—" : products.filter(p => p.isForSale).length.toString(), desc: "Retailable items" },
          { label: "Low Stock Items",    value: loading ? "—" : lowStockCount.toString(),                  desc: "Need reorder soon" },
          { label: "Total Retail Value", value: loading ? "—" : `₹${totalValue.toLocaleString("en-IN")}`, desc: "At sale price" },
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
          <p className="text-sm text-muted-foreground">Loading products…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Left: search + list ── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or brand…"
                className="input-luxury pl-9 text-sm w-full" />
            </div>

            <div className="flex gap-1 flex-wrap">
              {activeCats.map(c => {
                const label = c === "ALL" ? "All" : categories.find(x => x.value === c)?.label ?? c;
                return (
                  <button key={c} onClick={() => setCatFilter(c)}
                    className={cn("text-xs px-2.5 py-1 rounded-lg font-medium transition-all",
                      catFilter === c ? "bg-primary-500 text-white" : "bg-white border border-ivory-300 text-muted-foreground hover:border-primary-300"
                    )}>
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No products found.</p>
              ) : filtered.map(p => (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={cn("w-full text-left p-3.5 rounded-2xl border transition-all",
                    (selected ?? products[0]?.id) === p.id
                      ? "border-primary-300 bg-primary-50"
                      : "bg-white border-ivory-300 hover:border-primary-200"
                  )}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.brand || "—"} · {p.categoryLabel}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-sm font-bold" style={{ color: "#111111" }}>₹{p.price.toLocaleString("en-IN")}</p>
                      <p className={cn("text-[10px] mt-0.5", p.stock <= p.minStock ? "text-red-500 font-semibold" : "text-muted-foreground")}>
                        {p.stock} {p.unit}s left
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="badge text-[10px] bg-ivory-100 text-foreground border border-ivory-200">{p.categoryLabel}</span>
                    {p.isForSale && <span className="badge text-[10px] bg-emerald-100 text-emerald-700">For Sale</span>}
                    {p.stock <= p.minStock && <span className="badge text-[10px] bg-red-100 text-red-600">Low Stock</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: detail panel ── */}
          {prod ? (
            <div className="lg:col-span-3">
              <div className="card-luxury p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge text-[10px] bg-ivory-100 text-foreground border border-ivory-200">{prod.categoryLabel}</span>
                      {prod.isForSale && <span className="badge text-[10px] bg-emerald-100 text-emerald-700">For Retail</span>}
                      {prod.isForUse  && <span className="badge text-[10px] bg-blue-100 text-blue-700">Service Use</span>}
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-2">{prod.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{prod.brand || "—"} · {prod.sku}</p>
                    {prod.barcode && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <ScanLine className="w-3 h-3" /> {prod.barcode}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Sale Price", value: `₹${prod.price.toLocaleString("en-IN")}`, color: "#111111" },
                    { label: "Cost Price", value: `₹${prod.costPrice.toLocaleString("en-IN")}`, color: "#6B7280" },
                    { label: "MRP",        value: prod.mrp ? `₹${prod.mrp.toLocaleString("en-IN")}` : "—", color: "#6B7280" },
                  ].map(v => (
                    <div key={v.label} className="bg-ivory-50 rounded-xl p-3 border border-ivory-200 text-center">
                      <p className="text-base font-bold" style={{ color: v.color }}>{v.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{v.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-ivory-50 rounded-xl p-3 border border-ivory-200">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Stock Level</p>
                    <p className={cn("text-lg font-bold mt-1", prod.stock <= prod.minStock ? "text-red-500" : "text-foreground")}>
                      {prod.stock} <span className="text-sm font-normal text-muted-foreground">{prod.unit}s</span>
                    </p>
                    <div className="h-1.5 bg-ivory-200 rounded-full mt-2">
                      <div className="h-1.5 rounded-full transition-all" style={{
                        width: `${Math.min((prod.stock / (prod.minStock * 4)) * 100, 100)}%`,
                        background: prod.stock <= prod.minStock ? "#EF4444" : "#10B981",
                      }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Min: {prod.minStock} {prod.unit}s</p>
                  </div>

                  <div className="bg-ivory-50 rounded-xl p-3 border border-ivory-200">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Margin</p>
                    <p className="text-lg font-bold mt-1" style={{ color: "#10B981" }}>
                      {prod.costPrice > 0 ? `${Math.round(((prod.price - prod.costPrice) / prod.price) * 100)}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      ₹{(prod.price - prod.costPrice).toLocaleString("en-IN")} per {prod.unit}
                    </p>
                    {prod.mfgDate && <p className="text-[10px] text-muted-foreground mt-0.5">Mfg: {prod.mfgDate}</p>}
                    {prod.expiry && <p className="text-[10px] text-muted-foreground mt-0.5">Expiry: {prod.expiry}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">GST: {prod.gst}% · HSN {prod.hsn}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(prod)} className="btn-primary text-xs py-2 px-4">Edit Product</button>
                    <button onClick={() => setShowStockModal(true)} className="btn-outline text-xs py-2 px-4">Adjust Stock</button>
                  </div>
                  <button onClick={() => deleteProduct(prod.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs border border-red-200 hover:bg-red-50 py-2 px-3 rounded-xl transition-all flex items-center gap-1.5" title="Delete Product">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Product
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-3 card-luxury p-12 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a product to view details.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">{editingId ? "Edit Product" : "Add Product"}</h3>
              <button onClick={closeModal} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Product Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Wella Koleston Hair Color" className={iCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Barcode / QR Code</label>
                <div className="flex gap-2">
                  <input
                    value={form.barcode}
                    onChange={e => set("barcode", e.target.value)}
                    placeholder="Scan or type barcode…"
                    className={cn(iCls, "flex-1")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="px-3 py-2 rounded-xl border border-ivory-300 bg-ivory-50 hover:bg-primary-50 hover:border-primary-300 transition-all flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
                    title="Scan barcode with camera"
                  >
                    <Camera className="w-3.5 h-3.5" /> Scan
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Brand</label>
                  <input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="Brand name" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Category <span className="text-red-400">*</span></label>
                  <select value={form.category} onChange={e => set("category", e.target.value)} className={iCls}>
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Sale Price <span className="text-red-400">*</span></label>
                  <input type="number" value={form.price} onChange={e => set("price", e.target.value)} placeholder="₹" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Cost Price</label>
                  <input type="number" value={form.costPrice} onChange={e => set("costPrice", e.target.value)} placeholder="₹" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">MRP</label>
                  <input type="number" value={form.mrp} onChange={e => set("mrp", e.target.value)} placeholder="₹" className={iCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">{editingId ? "Min Stock" : "Opening Stock"}</label>
                  <input type="number" value={form.stock} onChange={e => set("stock", e.target.value)} placeholder="0" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Min Stock Alert</label>
                  <input type="number" value={form.minStock} onChange={e => set("minStock", e.target.value)} placeholder="5" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Unit</label>
                  <select value={form.unit} onChange={e => set("unit", e.target.value)} className={iCls}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">GST %</label>
                  <input type="number" value={form.gst} onChange={e => set("gst", e.target.value)} placeholder="18" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">HSN Code</label>
                  <input value={form.hsn} onChange={e => set("hsn", e.target.value)} placeholder="3305" className={iCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Mfg. Date</label>
                  <input type="month" value={form.mfgDate} onChange={e => set("mfgDate", e.target.value)} className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Expiry Date</label>
                  <input type="month" value={form.expiry} onChange={e => set("expiry", e.target.value)} className={iCls} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isForSale} onChange={e => set("isForSale", e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-xs font-medium text-foreground">Available for retail sale</span>
              </label>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              {editingId && (
                <button type="button" onClick={() => deleteProduct(editingId)} className="btn-outline border-red-300 text-red-500 hover:bg-red-50 text-sm py-2 px-3 flex items-center justify-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
              <div className="flex-1 flex gap-2">
                <button type="button" onClick={closeModal} className="flex-1 btn-outline text-sm py-2">Cancel</button>
                <button type="button" onClick={submit} disabled={submitting}
                  className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingId ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Barcode Scanner Modal ── */}
      {showScanner && (
        <BarcodeScanner
          onDetect={code => {
            setShowScanner(false);
            set("barcode", code);
            toast.success(`Barcode captured: ${code}`);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── Stock Adjust Modal ── */}
      {showStockModal && prod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowStockModal(false); }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Adjust Stock — {prod.name}</h3>
              <button onClick={() => setShowStockModal(false)} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">Current stock: <strong className="text-foreground">{prod.stock} {prod.unit}s</strong></p>
              <div className="flex gap-2">
                {(["IN", "OUT"] as const).map(t => (
                  <button key={t} onClick={() => setStockAdj(s => ({ ...s, type: t }))}
                    className={cn("flex-1 text-xs py-2 rounded-xl border font-semibold transition-all",
                      stockAdj.type === t ? "bg-primary-500 text-white border-primary-500" : "border-ivory-300 text-muted-foreground hover:border-primary-300"
                    )}>
                    {t === "IN" ? "Stock In (+)" : "Stock Out (-)"}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Quantity</label>
                <input type="number" value={stockAdj.qty} onChange={e => setStockAdj(s => ({ ...s, qty: e.target.value }))}
                  placeholder="Enter quantity" min="1"
                  className="w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Reason</label>
                <input value={stockAdj.reason} onChange={e => setStockAdj(s => ({ ...s, reason: e.target.value }))}
                  placeholder="e.g. Purchase received, Damaged…"
                  className="w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
              </div>
              {stockAdj.qty && (
                <p className="text-xs text-muted-foreground bg-ivory-50 p-2 rounded-xl border border-ivory-200">
                  New stock: <strong className="text-foreground">
                    {Math.max(0, stockAdj.type === "IN" ? prod.stock + Number(stockAdj.qty) : prod.stock - Number(stockAdj.qty))} {prod.unit}s
                  </strong>
                </p>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => setShowStockModal(false)} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submitStock} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving…" : "Confirm Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
