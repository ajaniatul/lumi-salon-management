"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { InvoiceA4, InvoiceData, generateInvoiceHTML } from "@/components/InvoiceA4";
import CustomerPicker, { type PickedCustomer } from "@/components/CustomerPicker";
import ItemPicker, { type PickedItem } from "@/components/ItemPicker";
import { Search, Plus, Minus, Trash2, Download, Printer, Receipt, CheckCircle, AlertTriangle, IndianRupee, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";
import toast from "react-hot-toast";

const GST_RATES = [5, 18] as const;
const PAY_METHODS = ["Cash","UPI","Card","Card + Cash","UPI + Cash","Card + UPI","Pending","Influencer (Barter)"];

const STATUS = {
  PAID:       { label:"Paid",       cls:"bg-emerald-100 text-emerald-700 border border-emerald-200" },
  PARTIAL:    { label:"Partial",    cls:"bg-blue-100 text-blue-700 border border-blue-200" },
  PENDING:    { label:"Unpaid",     cls:"bg-red-100 text-red-700 border border-red-200" },
  INFLUENCER: { label:"Influencer", cls:"bg-violet-100 text-violet-700 border border-violet-200" },
};

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";

type InvService = { name: string; sac: string };
type InvProduct = { name: string; hsn: string };
type InvLine    = { name: string; type: "Service"|"Product"; code: string; amount: number };
type InvoiceType = {
  id: string; dbId?: string; date: string; customer: string; phone: string;
  services: InvService[]; products: InvProduct[];
  items?: InvLine[]; subtotal: number; cgst: number; sgst: number;
  total: number; paid: number; due: number; method: string;
  status: string; loyalty: { earned: number; redeemed: number };
  discount: string; influencerNote: string; discountAmt?: number; description?: string;
  stylist?: string | null; stylistRole?: string | null;
};
type CartLine = { name: string; type: "Service"|"Product"; code: string; unitPrice: number; qty: number; dbId: string };

// ── Invoice Detail Modal ───────────────────────────────────────────────────
function InvoiceModal({ inv, onClose, onRecordPayment, settings }: {
  inv: InvoiceType;
  onClose: () => void;
  onRecordPayment?: (dbId: string, amount: number, method: string) => Promise<void>;
  settings?: any;
}) {
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmt,      setPayAmt]      = useState(String(inv.due));
  const [payMethod,   setPayMethod]   = useState("Cash");
  const [saving,      setSaving]      = useState(false);

  const itemCount = inv.services.length + inv.products.length;
  const amtEach   = Math.round(inv.subtotal / Math.max(itemCount, 1));

  const lineItems: InvLine[] = inv.items && inv.items.length > 0
    ? inv.items
    : [
        ...inv.services.map(s => ({ name: s.name, type:"Service" as const, code: s.sac, amount: amtEach })),
        ...inv.products.map(p => ({ name: p.name, type:"Product" as const, code: p.hsn, amount: amtEach })),
      ];

  const halfGst = inv.subtotal > 0 ? Math.round(inv.cgst / inv.subtotal * 100) : 9;

  const a4Data: InvoiceData = {
    invoiceNo:    inv.id,
    date:         inv.date,
    customer:     inv.customer,
    phone:        inv.phone,
    stylist:      inv.stylist ?? undefined,
    stylistRole:  inv.stylistRole ?? undefined,
    items:        lineItems.map(it => ({ description: it.name, type: it.type, hsnCode: it.code, amount: it.amount })),
    subtotal:     inv.subtotal,
    discountAmt:  inv.discountAmt || undefined,
    discountNote: inv.discount    || undefined,
    notes:        inv.description || undefined,
    cgst:         inv.cgst,
    sgst:         inv.sgst,
    halfGst,
    total:        inv.total,
    payMethod:    inv.method === "-" ? "Pending" : inv.method,
    status:       inv.status as "PAID"|"PARTIAL"|"PENDING"|"INFLUENCER",
    loyaltyPoints: inv.loyalty.earned,
    brandName:    settings?.salonName,
    brandTagline: settings?.tagline,
    brandAddress: settings?.address,
    brandGstin:   settings?.gstin,
    brandPhone:   settings?.phone,
    brandEmail:   settings?.email,
    brandLogo:    settings?.logo,
  };

  return (
    <>
      {/* A4 invoice — shown directly, no card modal */}
      <InvoiceA4
        data={a4Data}
        onClose={onClose}
        actions={inv.due > 0 && inv.status !== "INFLUENCER" ? (
          <button
            onClick={() => setShowPayForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background:"linear-gradient(135deg,#10B981,#059669)" }}>
            Record Payment
          </button>
        ) : undefined}
      />

      {/* Payment form — floats above the A4 view */}
      {showPayForm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowPayForm(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-ivory-200 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Record Payment</p>
              <button onClick={() => setShowPayForm(false)} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">Balance due: <strong className="text-red-500">Rs.{inv.due.toLocaleString("en-IN")}</strong></p>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Amount (Rs.)</label>
                <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} max={inv.due}
                  className="w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Payment Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white">
                  {["Cash","UPI","Card","Card + Cash","UPI + Cash"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => setShowPayForm(false)} className="flex-1 btn-outline text-xs py-2">Cancel</button>
              <button disabled={saving} onClick={async () => {
                const amt = Math.min(Number(payAmt) || 0, inv.due);
                if (amt > 0 && onRecordPayment && inv.dbId) {
                  setSaving(true);
                  await onRecordPayment(inv.dbId, amt, payMethod);
                  setSaving(false);
                  setShowPayForm(false);
                  onClose();
                }
              }} className="flex-1 text-xs py-2 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { setAction } = useHeaderAction();
  const [invoices,   setInvoices]   = useState<InvoiceType[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("ALL");
  const [showAll,    setShowAll]    = useState(false);
  const [open,       setOpen]       = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [err,        setErr]        = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settings,   setSettings]   = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success) setSettings(json.data);
      } catch {}
    })();
  }, []);

  // Create-invoice form state
  const [pickedCust,   setPickedCust]   = useState<PickedCustomer|null>(null);
  const [cart,         setCart]         = useState<CartLine[]>([]);
  const [addType,      setAddType]      = useState<"Service"|"Product">("Service");
  const [pickerKey,    setPickerKey]    = useState(0);
  const [gstRate,      setGstRate]      = useState<5|18>(18);
  const [method,       setMethod]       = useState("UPI");
  const [paidAmt,      setPaidAmt]      = useState("");
  const [discountAmt,  setDiscountAmt]  = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [collabNote,   setCollabNote]   = useState("");
  const [description,  setDescription]  = useState("");

  // ── Load invoices from DB ──
  const loadInvoices = useCallback(() => {
    setLoading(true);
    fetch("/api/invoices")
      .then(r => r.json())
      .then(j => { if (j.success) setInvoices(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // ── Register "Create Invoice" in header ──
  const openCreate = useCallback(() => setShowCreate(true), []);
  useEffect(() => {
    setAction({ label: "Create Invoice", onClick: openCreate });
    return () => setAction(null);
  }, [setAction, openCreate]);

  // ── Summary stats ──
  const totalRevenue    = invoices.filter(i => i.status==="PAID").reduce((s,i) => s+i.total, 0);
  const totalPending    = invoices.filter(i => i.status==="PENDING"||i.status==="PARTIAL").reduce((s,i) => s+i.due, 0);
  const totalInfluencer = invoices.filter(i => i.status==="INFLUENCER").reduce((s,i) => s+i.total, 0);
  const totalGST        = invoices.filter(i => i.status!=="INFLUENCER").reduce((s,i) => s+i.cgst+i.sgst, 0);

  const q           = search.trim().toLowerCase();
  const isSearching = q.length > 0;
  const showList    = isSearching || showAll || filter !== "ALL";

  const filtered = invoices.filter(i => {
    const matchQ = !isSearching || i.customer.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
    const matchS = filter==="ALL" || i.status===filter;
    return matchQ && matchS;
  });

  const openedInv = invoices.find(i => i.id===open) ?? null;

  // ── Cart helpers ──
  const addItem = (it: PickedItem) => {
    if (!it.dbId) return;
    setCart(c => {
      const idx = c.findIndex(l => l.dbId === it.dbId);
      if (idx >= 0) return c.map((l, i) => i === idx ? { ...l, qty: l.qty + 1 } : l);
      return [...c, { name: it.name, type: addType, code: it.code, unitPrice: it.price, qty: 1, dbId: it.dbId }];
    });
    setPickerKey(k => k + 1);
  };
  const updateQty  = (i: number, delta: number) =>
    setCart(c => c.map((l, idx) => idx === i ? { ...l, qty: Math.max(1, l.qty + delta) } : l));
  const removeLine = (i: number) => setCart(c => c.filter((_, idx) => idx !== i));

  // ── Totals ──
  const rawSubtotal = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.qty, 0), [cart]);
  const discAmt     = Math.min(Number(discountAmt) || 0, rawSubtotal);
  const subtotal    = rawSubtotal - discAmt;
  const cgst        = Math.round(subtotal * (gstRate / 2 / 100) * 100) / 100;
  const sgst        = cgst;
  const total       = subtotal + cgst + sgst;
  const isInfluencer = method === "Influencer (Barter)";
  const isPending    = method === "Pending";

  const resetForm = () => {
    setPickedCust(null); setCart([]); setAddType("Service"); setGstRate(18);
    setMethod("UPI"); setPaidAmt(""); setDiscountAmt(""); setDiscountNote("");
    setCollabNote(""); setDescription(""); setErr("");
  };
  const closeCreate = () => { setShowCreate(false); resetForm(); };

  const submitInvoice = async () => {
    if (!pickedCust?.name) { setErr("Select a customer."); return; }
    if (cart.length === 0) { setErr("Add at least one service or product."); return; }
    setSubmitting(true);
    setErr("");
    const paidFinal = (isInfluencer || isPending) ? 0
      : (paidAmt ? Math.min(Number(paidAmt) || total, total) : total);

    try {
      const res = await fetch("/api/invoices", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId:  pickedCust.id,
          items:       cart.map(l => ({ type: l.type, dbId: l.dbId, name: l.name, unitPrice: l.unitPrice, qty: l.qty, gstRate })),
          rawSubtotal,
          discountAmt: discAmt,
          discountNote: discountNote.trim(),
          gstRate,
          cgst,
          sgst,
          total,
          paidAmt:     paidFinal,
          methodLabel: isInfluencer ? "Influencer (Barter)" : isPending ? "Pending" : method,
          description: description.trim(),
          collabNote:  collabNote.trim(),
          isInfluencer,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) { setErr(j.error || "Failed to create invoice."); setSubmitting(false); return; }
      setInvoices(prev => [j.data, ...prev]);
      toast.success("Invoice created");
      closeCreate();
      setShowAll(true);
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const recordPayment = async (dbId: string, amount: number, methodLabel: string) => {
    try {
      const res = await fetch(`/api/invoices/${dbId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount, methodLabel }),
      });
      const j = await res.json();
      if (j.success) {
        setInvoices(prev => prev.map(inv =>
          inv.dbId === dbId
            ? { ...inv, paid: j.paid, due: j.due, status: j.status }
            : inv
        ));
        toast.success("Payment recorded");
      } else {
        toast.error(j.error || "Failed to record payment");
      }
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:"Revenue",     value:`Rs.${totalRevenue.toLocaleString("en-IN")}`,         sub:"from paid invoices",      color:"#10B981", icon:IndianRupee   },
          { label:"Outstanding", value:`Rs.${totalPending.toLocaleString("en-IN")}`,         sub:"unpaid / partial",        color:"#EF4444", icon:AlertTriangle },
          { label:"Influencer",  value:`Rs.${totalInfluencer.toLocaleString("en-IN")}`,      sub:"barter value",            color:"#7C3AED", icon:CheckCircle   },
          { label:"GST",         value:`Rs.${Math.round(totalGST).toLocaleString("en-IN")}`, sub:"CGST + SGST (cash only)", color:"#6366F1", icon:Receipt       },
        ].map(s => (
          <div key={s.label} className="card-luxury p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:`${s.color}18` }}>
              <s.icon className="w-4 h-4" style={{ color:s.color }} />
            </div>
            <div>
              <p className="text-base font-display font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setShowAll(false); }}
            placeholder="Search invoice ID or customer name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ivory-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all"
          />
        </div>
        <div className="flex gap-1.5">
          {(["ALL","PAID","PARTIAL","PENDING","INFLUENCER"] as const).map(s => (
            <button key={s} onClick={() => { setFilter(s); if (s!=="ALL") setShowAll(true); }}
              className={cn("text-xs px-3 py-2 rounded-xl font-semibold transition-all border",
                filter===s ? "text-white border-transparent" : "bg-white border-ivory-300 text-muted-foreground hover:border-primary-300"
              )}
              style={filter===s ? { background: s==="INFLUENCER" ? "#7C3AED" : "#B76E79", borderColor: s==="INFLUENCER" ? "#7C3AED" : "#B76E79" } : {}}>
              {s==="ALL" ? "All" : STATUS[s as keyof typeof STATUS]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Invoice list ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading invoices…</span>
        </div>
      ) : !showList ? (
        <div className="text-center py-10 space-y-4">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background:"linear-gradient(135deg,#FCF5F6,#F7E8EA)" }}>
            <Receipt className="w-7 h-7" style={{ color:"#B76E79" }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Search above to find an invoice</p>
            <p className="text-xs text-muted-foreground mt-0.5">or</p>
          </div>
          {invoices.length > 0 ? (
            <button onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary-200 text-sm font-semibold transition-all hover:bg-primary-50"
              style={{ color:"#B76E79" }}>
              <Receipt className="w-4 h-4" /> Browse all {invoices.length} invoice{invoices.length!==1?"s":""}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">No invoices yet — create your first one above</p>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No invoices match your search</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{filtered.length} invoice{filtered.length!==1?"s":""}</p>
            {showAll && !isSearching && filter==="ALL" && (
              <button onClick={() => setShowAll(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Collapse</button>
            )}
          </div>
          {filtered.map(inv => {
            const st = STATUS[inv.status as keyof typeof STATUS];
            const itemNames = [...inv.services.map(s => s.name), ...inv.products.map(p => p.name)].join(", ");
            return (
              <button key={inv.id} onClick={() => setOpen(inv.id)}
                className="w-full text-left bg-white border border-ivory-200 rounded-2xl px-4 py-3.5 hover:border-primary-300 hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-foreground">{inv.customer}</p>
                      <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold border flex-shrink-0", st?.cls)}>{st?.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{inv.id} · {inv.date} · {inv.method}</p>
                    {itemNames && <p className="text-xs text-muted-foreground mt-1 truncate">{itemNames}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-display font-bold" style={{ color: inv.status==="INFLUENCER"?"#7C3AED":"#B76E79" }}>Rs.{inv.total.toLocaleString("en-IN")}</p>
                    {inv.status==="INFLUENCER" ? <p className="text-xs font-semibold" style={{ color:"#7C3AED" }}>Barter value</p>
                    : inv.due>0 ? <p className="text-xs text-red-500 font-semibold">Due Rs.{inv.due.toLocaleString("en-IN")}</p>
                               : <p className="text-xs text-emerald-600 font-semibold">Fully paid</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Invoice detail modal */}
      {openedInv && (
        <InvoiceModal
          inv={openedInv}
          onClose={() => setOpen(null)}
          onRecordPayment={recordPayment}
          settings={settings}
        />
      )}

      {/* ── Create Invoice Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(20,12,14,0.82)", backdropFilter:"blur(4px)" }}
          onClick={e => { if (e.target===e.currentTarget) closeCreate(); }}>
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200 flex-shrink-0">
              <h3 className="text-sm font-bold text-foreground">Create Invoice</h3>
              <button onClick={closeCreate} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}

              {/* Customer */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Customer <span className="text-red-400">*</span></label>
                <CustomerPicker value={pickedCust} onChange={setPickedCust} iCls={iCls} />
              </div>

              {/* Add item */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Add Item</label>
                <div className="flex rounded-xl border border-ivory-300 overflow-hidden mb-2">
                  {(["Service","Product"] as const).map(t => (
                    <button key={t} type="button" onClick={() => setAddType(t)}
                      className="flex-1 py-2 text-sm font-semibold transition-all"
                      style={addType===t ? { background:"#B76E79", color:"#fff" } : { background:"#fff", color:"#6B7280" }}>
                      {t==="Service" ? "⚙ Service" : "📦 Product"}
                    </button>
                  ))}
                </div>
                <ItemPicker key={pickerKey} mode={addType} value="" onSelect={addItem} iCls={iCls} />
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div className="rounded-xl border border-ivory-200 overflow-hidden">
                  {cart.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2.5 border-b border-ivory-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{l.name}</p>
                        <p className="text-[10px] text-muted-foreground">{l.type} · {l.type==="Service"?"SAC":"HSN"} {l.code} · Rs.{l.unitPrice.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => updateQty(i, -1)} className="w-5 h-5 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200"><Minus className="w-3 h-3" /></button>
                        <span className="text-sm font-bold w-5 text-center">{l.qty}</span>
                        <button onClick={() => updateQty(i, 1)} className="w-5 h-5 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200"><Plus className="w-3 h-3" /></button>
                      </div>
                      <span className="text-sm font-bold w-20 text-right flex-shrink-0" style={{ color:"#B76E79" }}>Rs.{(l.unitPrice*l.qty).toLocaleString("en-IN")}</span>
                      <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* GST rate */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">GST Rate</label>
                <div className="flex rounded-xl border border-ivory-300 overflow-hidden">
                  {GST_RATES.map(r => (
                    <button key={r} type="button" onClick={() => setGstRate(r)}
                      className="flex-1 py-2 text-sm font-bold transition-all"
                      style={gstRate===r ? { background:"#B76E79", color:"#fff" } : { background:"#fff", color:"#6B7280" }}>
                      {r}% (CGST {r/2}% + SGST {r/2}%)
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Discount (Rs.)</label>
                  <input type="number" min="0" value={discountAmt} onChange={e => setDiscountAmt(e.target.value)} placeholder="0" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Discount Note</label>
                  <input value={discountNote} onChange={e => setDiscountNote(e.target.value)} placeholder="e.g. Gold Member 10%" className={iCls} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Description / Notes</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Additional details, special instructions..." rows={2} className={iCls + " resize-none"} />
              </div>

              {/* Payment method */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Payment Method <span className="text-red-400">*</span></label>
                <select value={method} onChange={e => setMethod(e.target.value)} className={iCls}>
                  {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Amount paid */}
              {!isInfluencer && !isPending && (
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Amount Paid (Rs.) <span className="text-muted-foreground font-normal">— leave blank for full</span></label>
                  <input type="number" value={paidAmt} onChange={e => setPaidAmt(e.target.value)}
                    placeholder={`${total.toLocaleString("en-IN")} (full)`} className={iCls} />
                </div>
              )}

              {/* Influencer collab */}
              {isInfluencer && (
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Collab Details</label>
                  <input value={collabNote} onChange={e => setCollabNote(e.target.value)}
                    placeholder="e.g. 2 posts + 3 stories @handle" className={iCls} />
                </div>
              )}

              {/* Live totals */}
              {cart.length > 0 && (
                <div className="bg-ivory-50 rounded-xl p-3 border border-ivory-200 text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal (excl. GST)</span><span>Rs.{rawSubtotal.toLocaleString("en-IN")}</span></div>
                  {discAmt > 0 && <div className="flex justify-between text-emerald-600"><span>Discount{discountNote ? ` (${discountNote})` : ""}</span><span>− Rs.{discAmt.toLocaleString("en-IN")}</span></div>}
                  <div className="flex justify-between text-muted-foreground"><span>Taxable Amount</span><span>Rs.{subtotal.toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>CGST @ {gstRate/2}%</span><span>Rs.{cgst.toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>SGST @ {gstRate/2}%</span><span>Rs.{sgst.toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold text-foreground border-t border-ivory-300 pt-1 mt-1">
                    <span>Grand Total</span><span style={{ color:"#B76E79" }}>Rs.{total.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50 flex-shrink-0">
              <button onClick={closeCreate} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submitInvoice} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
