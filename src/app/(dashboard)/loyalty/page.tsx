"use client";
import { useState, useEffect } from "react";
import { Star, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type LoyaltyCustomer = {
  id: string; name: string; phone: string; tier: string | null;
  points: number; earned: number; redeemed: number;
  expiry: string; lastTxn: string;
};
type Txn = { date: string; customer: string; type: "EARN" | "REDEEM"; pts: number; reason: string; balance: number };

const TIER_COLORS: Record<string,string> = {
  SILVER:"bg-gray-100 text-gray-600 border border-gray-200",
  GOLD:"bg-amber-100 text-amber-700 border border-amber-200",
  PLATINUM:"bg-primary-100 text-primary-700 border border-primary-200",
};

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";

export default function LoyaltyPage() {
  const [tab, setTab] = useState<"customers"|"transactions">("customers");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLoyalty = () => {
    setLoading(true);
    fetch("/api/loyalty")
      .then(res => res.json())
      .then(json => {
        if (json.success) { setCustomers(json.data.customers); setTxns(json.data.transactions); }
        else toast.error(json.error ?? "Failed to load loyalty data.");
      })
      .catch(() => toast.error("Failed to load loyalty data."))
      .finally(() => setLoading(false));
  };

  useEffect(loadLoyalty, []);

  // Adjust-points modal
  const [adjustId, setAdjustId] = useState<string|null>(null);
  const [adjType, setAdjType] = useState<"EARN"|"REDEEM">("EARN");
  const [adjPts, setAdjPts] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjErr, setAdjErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalPoints = customers.reduce((s,c) => s+c.points, 0);
  const totalRedeemed = customers.reduce((s,c) => s+c.redeemed, 0);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const adjustCust = customers.find(c => c.id === adjustId) ?? null;

  const openAdjust = (id: string) => { setAdjustId(id); setAdjType("EARN"); setAdjPts(""); setAdjReason(""); setAdjErr(""); };
  const closeAdjust = () => setAdjustId(null);

  const submitAdjust = async () => {
    if (!adjustCust) return;
    const pts = Number(adjPts);
    if (!pts || pts <= 0) { setAdjErr("Enter a valid number of points."); return; }
    if (adjType === "REDEEM" && pts > adjustCust.points) { setAdjErr(`Customer only has ${adjustCust.points} points.`); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: adjustCust.id, type: adjType, points: pts, reason: adjReason }),
      });
      const json = await res.json();
      if (!json.success) { setAdjErr(json.error ?? "Failed to adjust points."); return; }
      toast.success(adjType === "EARN" ? "Points added." : "Points redeemed.");
      closeAdjust();
      loadLoyalty();
    } catch {
      setAdjErr("Failed to adjust points.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-6 space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Loyalty Program</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Track earned and redeemed loyalty points per customer. Customers earn 1 point per ₹100 spent and redeem 100 points = ₹100 off.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:"Total Points Issued", value:customers.reduce((s,c)=>s+c.earned,0).toLocaleString("en-IN"), desc:"All time, all customers" },
          { label:"Points Redeemed", value:totalRedeemed.toLocaleString("en-IN"), desc:`₹${totalRedeemed.toLocaleString("en-IN")} in discounts given` },
          { label:"Points Outstanding", value:totalPoints.toLocaleString("en-IN"), desc:`₹${totalPoints.toLocaleString("en-IN")} potential liability` },
          { label:"Active Loyalty Members", value:customers.filter(c => c.points > 0).length.toString(), desc:"Customers with points" },
        ].map(s => (
          <div key={s.label} className="card-luxury p-4">
            <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-xs font-semibold text-foreground mt-1">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-ivory-200">
        {([["customers","Customer Points"],["transactions","Transaction History"]] as const).map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab===v?"border-primary-500 text-primary-600":"border-transparent text-muted-foreground hover:text-foreground"
            )}>{l}</button>
        ))}
      </div>

      {tab === "customers" && (
        <div className="space-y-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer..." className="input-luxury pl-9 text-sm" />
          </div>
          <div className="card-luxury overflow-hidden">
            <table className="table-luxury">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Membership Tier</th>
                  <th>Current Balance</th>
                  <th>Total Earned</th>
                  <th>Total Redeemed</th>
                  <th>Last Transaction</th>
                  <th>Points Expiry</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8}><p className="text-sm text-muted-foreground py-6 text-center">No loyalty activity yet.</p></td></tr>
                )}
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </td>
                    <td>{c.tier ? <span className={cn("badge text-[10px]", TIER_COLORS[c.tier])}>{c.tier.charAt(0)+c.tier.slice(1).toLowerCase()}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <p className="text-sm font-bold text-foreground">{c.points.toLocaleString("en-IN")} pts</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">= ₹{c.points.toLocaleString("en-IN")} redeemable</p>
                    </td>
                    <td><p className="text-sm text-emerald-600 font-semibold">+{c.earned.toLocaleString("en-IN")}</p></td>
                    <td><p className="text-sm text-muted-foreground">{c.redeemed > 0 ? `-${c.redeemed.toLocaleString("en-IN")}` : "—"}</p></td>
                    <td><p className="text-xs text-muted-foreground">{c.lastTxn}</p></td>
                    <td><p className="text-xs text-muted-foreground">{c.expiry}</p></td>
                    <td>
                      <button onClick={() => openAdjust(c.id)} className="text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100 transition-colors">Adjust</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <div className="card-luxury overflow-hidden">
          <table className="table-luxury">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Transaction Type</th>
                <th>Points</th>
                <th>Reason</th>
                <th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t,i) => (
                <tr key={i}>
                  <td><p className="text-xs text-muted-foreground">{t.date}</p></td>
                  <td><p className="text-sm font-semibold text-foreground">{t.customer}</p></td>
                  <td>
                    <span className={cn("badge text-[10px]", t.type==="EARN"?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-600")}>
                      {t.type==="EARN"?"▲ Points Earned":"▼ Points Redeemed"}
                    </span>
                  </td>
                  <td>
                    <p className={cn("text-sm font-bold", t.type==="EARN"?"text-emerald-600":"text-red-500")}>
                      {t.type==="EARN"?"+":"-"}{t.pts} pts
                    </p>
                  </td>
                  <td><p className="text-xs text-muted-foreground">{t.reason}</p></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400" />
                      <p className="text-sm font-semibold text-foreground">{t.balance.toLocaleString("en-IN")}</p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust points modal */}
      {adjustCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(20,12,14,0.82)", backdropFilter:"blur(4px)" }}
          onClick={e => { if (e.target===e.currentTarget) closeAdjust(); }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <div>
                <h3 className="text-sm font-bold text-foreground">Adjust Points</h3>
                <p className="text-[11px] text-muted-foreground">{adjustCust.name} · {adjustCust.points.toLocaleString("en-IN")} pts</p>
              </div>
              <button onClick={closeAdjust} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {adjErr && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{adjErr}</p>}
              <div className="flex rounded-xl border border-ivory-300 overflow-hidden">
                {(["EARN","REDEEM"] as const).map(t => (
                  <button key={t} onClick={() => { setAdjType(t); setAdjErr(""); }}
                    className="flex-1 py-2 text-sm font-semibold transition-all"
                    style={adjType===t
                      ? { background: t==="EARN" ? "#10B981" : "#EF4444", color:"#fff" }
                      : { background:"#fff", color:"#6B7280" }}>
                    {t==="EARN" ? "▲ Add Points" : "▼ Redeem Points"}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Points <span className="text-red-400">*</span></label>
                <input type="number" min="1" value={adjPts} onChange={e => setAdjPts(e.target.value)} placeholder="e.g. 50" className={iCls} />
                {adjType==="REDEEM" && <p className="text-[10px] text-muted-foreground mt-1">100 points = ₹100 discount. Available: {adjustCust.points} pts.</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Reason</label>
                <input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="e.g. Birthday bonus, complaint goodwill..." className={iCls} />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={closeAdjust} disabled={submitting} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submitAdjust} disabled={submitting} className="flex-1 btn-primary text-sm py-2">{submitting ? "Saving…" : adjType==="EARN" ? "Add Points" : "Redeem Points"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
