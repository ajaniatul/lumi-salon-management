"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Edit2, Trash2, X, BookOpen, TrendingUp, TrendingDown, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";

type EntryType = "RECEIPT" | "PAYMENT";
interface CashEntry {
  id: string; date: string; voucherNo: string;
  description: string; category: string; type: EntryType; amount: number;
}

const CATEGORIES = ["Office Supplies","Travel","Food & Refreshments","Postage & Courier","Printing","Utilities","Maintenance","Staff Welfare","Miscellaneous"];
const DEFAULT_FORM = { date: new Date().toISOString().slice(0,10), description: "", category: CATEGORIES[0], type: "PAYMENT" as EntryType, amount: "" };
const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white";

export default function PettyCashPage() {
  const { setAction } = useHeaderAction();

  const [entries,          setEntries]          = useState<CashEntry[]>([]);
  const [openingBalance,   setOpeningBalance]   = useState(0);
  const [loading,          setLoading]          = useState(true);
  const [showModal,        setShowModal]        = useState(false);
  const [editingId,        setEditingId]        = useState<string | null>(null);
  const [form,             setForm]             = useState(DEFAULT_FORM);
  const [err,              setErr]              = useState("");
  const [submitting,       setSubmitting]       = useState(false);
  const [filterCat,        setFilterCat]        = useState("ALL");
  const [filterType,       setFilterType]       = useState("ALL");
  const [deleteId,         setDeleteId]         = useState<string | null>(null);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingDraft,     setOpeningDraft]     = useState("0");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/petty-cash")
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setEntries(j.data);
          setOpeningBalance(j.openingBalance ?? 0);
          setOpeningDraft(String(j.openingBalance ?? 0));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAddModal    = useCallback(() => { setEditingId(null); setForm(DEFAULT_FORM); setErr(""); setShowModal(true); }, []);
  const openOpeningModal = useCallback(() => setShowOpeningModal(true), []);

  useEffect(() => {
    setAction([
      { label: "Opening Balance", variant: "outline", icon: "wallet", onClick: openOpeningModal },
      { label: "Add Entry",       onClick: openAddModal },
    ]);
    return () => setAction(null);
  }, [setAction, openAddModal, openOpeningModal]);

  // Running balance — starts from opening balance
  const withBalance = useMemo(() => {
    let bal = openingBalance;
    return entries.map(e => {
      bal = e.type === "RECEIPT" ? bal + e.amount : bal - e.amount;
      return { ...e, balance: bal };
    });
  }, [entries, openingBalance]);

  const filtered = useMemo(() => withBalance.filter(e =>
    (filterCat  === "ALL" || e.category === filterCat) &&
    (filterType === "ALL" || e.type     === filterType)
  ), [withBalance, filterCat, filterType]);

  const totalReceipts  = entries.filter(e => e.type === "RECEIPT").reduce((s, e) => s + e.amount, 0);
  const totalPayments  = entries.filter(e => e.type === "PAYMENT").reduce((s, e) => s + e.amount, 0);
  const closingBalance = openingBalance + totalReceipts - totalPayments;

  const openEdit = (e: CashEntry) => {
    setForm({ date: e.date, description: e.description, category: e.category, type: e.type, amount: String(e.amount) });
    setEditingId(e.id);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setErr(""); setForm(DEFAULT_FORM); };

  const submit = async () => {
    if (!form.description.trim()) { setErr("Description is required."); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { setErr("Enter a valid amount."); return; }
    setSubmitting(true);
    try {
      const res = editingId
        ? await fetch(`/api/petty-cash/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        : await fetch("/api/petty-cash",              { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j.success) { closeModal(); load(); }
      else setErr(j.error || "Failed to save.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/petty-cash/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  const saveOpening = async () => {
    const val = Number(openingDraft);
    if (isNaN(val) || val < 0) return;
    await fetch("/api/petty-cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_opening_balance", amount: val }),
    });
    setOpeningBalance(val);
    setShowOpeningModal(false);
  };

  const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-luxury p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(183,110,121,0.10)" }}>
              <BookOpen className="w-3.5 h-3.5" style={{ color: "#B76E79" }} />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Opening Balance</p>
          </div>
          <p className="text-lg font-display font-bold text-foreground">{loading ? "—" : fmt(openingBalance)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Petty cash float</p>
        </div>
        <div className="card-luxury p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-emerald-50">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Total Receipts</p>
          </div>
          <p className="text-lg font-display font-bold text-emerald-600">{loading ? "—" : fmt(totalReceipts)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{entries.filter(e => e.type === "RECEIPT").length} receipt entries</p>
        </div>
        <div className="card-luxury p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-red-50">
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Total Payments</p>
          </div>
          <p className="text-lg font-display font-bold text-red-500">{loading ? "—" : fmt(totalPayments)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{entries.filter(e => e.type === "PAYMENT").length} payment entries</p>
        </div>
        <div className="card-luxury p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(196,149,106,0.12)" }}>
              <Wallet className="w-3.5 h-3.5" style={{ color: "#C4956A" }} />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Closing Balance</p>
          </div>
          <p className={cn("text-lg font-display font-bold", closingBalance >= 0 ? "text-foreground" : "text-red-500")}>
            {loading ? "—" : fmt(closingBalance)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Cash in hand</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#B76E79" }} />
          <p className="text-sm text-muted-foreground">Loading ledger…</p>
        </div>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-ivory-300 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="ALL">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="flex rounded-xl border border-ivory-300 overflow-hidden">
              {(["ALL","RECEIPT","PAYMENT"] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={cn("text-xs px-3 py-1.5 font-medium transition-colors",
                    filterType === t ? "bg-primary-500 text-white" : "bg-white text-muted-foreground hover:bg-ivory-100"
                  )}>
                  {t === "ALL" ? "All" : t === "RECEIPT" ? "Receipts" : "Payments"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground ml-auto">{filtered.length} of {entries.length} entries</p>
          </div>

          {/* ── Ledger table ── */}
          <div className="card-luxury overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-luxury w-full">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Voucher No</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Description</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Category</th>
                    <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-emerald-600">Receipt (Dr)</th>
                    <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-red-500">Payment (Cr)</th>
                    <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Balance</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                        {entries.length === 0
                          ? "No entries yet. Click Add Entry to get started."
                          : "No entries for the selected filters."}
                      </td>
                    </tr>
                  ) : filtered.map((e, i) => (
                    <tr key={e.id} className={cn("border-t border-ivory-100 hover:bg-ivory-50 transition-colors", i % 2 !== 0 && "bg-ivory-50/40")}>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-ivory-100 px-1.5 py-0.5 rounded-lg">{e.voucherNo}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-foreground max-w-xs">{e.description}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-ivory-100 text-muted-foreground">{e.category}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-medium text-emerald-600">
                        {e.type === "RECEIPT" ? fmt(e.amount) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-medium text-red-500">
                        {e.type === "PAYMENT" ? fmt(e.amount) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-semibold text-foreground whitespace-nowrap">
                        {fmt(e.balance)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(e)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-ivory-200 transition-colors">
                            <Edit2 className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button onClick={() => setDeleteId(e.id)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-ivory-300 bg-ivory-50">
                      <td colSpan={4} className="py-3 px-4 text-xs font-bold text-foreground">TOTAL</td>
                      <td className="py-3 px-4 text-right text-xs font-bold text-emerald-600">{fmt(totalReceipts)}</td>
                      <td className="py-3 px-4 text-right text-xs font-bold text-red-500">{fmt(totalPayments)}</td>
                      <td className="py-3 px-4 text-right text-xs font-bold text-foreground">{fmt(closingBalance)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Add / Edit Entry Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">{editingId ? "Edit Entry" : "New Cash Entry"}</h3>
              <button onClick={closeModal} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {err && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
              <div className="flex rounded-xl border border-ivory-300 overflow-hidden">
                <button onClick={() => set("type", "RECEIPT")}
                  className={cn("flex-1 text-sm py-2 font-medium transition-colors",
                    form.type === "RECEIPT" ? "bg-emerald-500 text-white" : "bg-white text-muted-foreground hover:bg-ivory-100")}>
                  ↑ Receipt
                </button>
                <button onClick={() => set("type", "PAYMENT")}
                  className={cn("flex-1 text-sm py-2 font-medium transition-colors",
                    form.type === "PAYMENT" ? "bg-red-500 text-white" : "bg-white text-muted-foreground hover:bg-ivory-100")}>
                  ↓ Payment
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.date} onChange={e => set("date", e.target.value)} className={iCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Description <span className="text-red-400">*</span></label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)}
                  placeholder="What was this for?" rows={2} className={iCls + " resize-none"} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Category</label>
                <select value={form.category} onChange={e => set("category", e.target.value)} className={iCls}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Amount (₹) <span className="text-red-400">*</span></label>
                <input type="number" min="1" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" className={iCls} />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={closeModal} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingId ? "Save Changes" : "Add Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Opening Balance Modal ── */}
      {showOpeningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowOpeningModal(false); }}>
          <div className="w-full max-w-xs bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Set Opening Balance</h3>
              <button onClick={() => setShowOpeningModal(false)} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5">
              <label className="text-xs font-semibold text-foreground block mb-1">Opening Balance (₹)</label>
              <input type="number" min="0" value={openingDraft} onChange={e => setOpeningDraft(e.target.value)} className={iCls} />
              <p className="text-[11px] text-muted-foreground mt-2">Petty cash float received at the start of the period.</p>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => setShowOpeningModal(false)} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={saveOpening} className="flex-1 btn-primary text-sm py-2">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}>
          <div className="w-full max-w-xs bg-white rounded-3xl overflow-hidden shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Delete this entry?</p>
              <p className="text-xs text-muted-foreground mt-1">This will permanently remove the entry and recalculate the running balance.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 text-sm py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
