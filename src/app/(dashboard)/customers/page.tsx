"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Crown, TrendingUp, Users, ChevronRight, X, Cake, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";

type Customer = {
  id: string; name: string; phone: string; email: string;
  visits: number; totalSpent: string; lastVisit: string;
  membership: string | null; birthday: string; tags: string[];
};

const TIER_STYLE: Record<string, { pill: string; grad: string }> = {
  Platinum: { pill:"bg-purple-100 text-purple-700 border border-purple-200", grad:"linear-gradient(135deg,#7C3AED,#A78BFA)" },
  Gold:     { pill:"bg-amber-100 text-amber-700 border border-amber-200",    grad:"linear-gradient(135deg,#B45309,#FCD34D)" },
  Silver:   { pill:"bg-gray-100 text-gray-600 border border-gray-200",       grad:"linear-gradient(135deg,#6B7280,#D1D5DB)" },
};

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";
const DEFAULT_FORM = { name:"", phone:"", email:"", gender:"", dob:"" };

function CustomerCard({ c, onClick }: { c: Customer; onClick: () => void }) {
  const tier = c.membership ? TIER_STYLE[c.membership] : null;
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white border border-ivory-200 rounded-2xl p-4 hover:border-primary-300 hover:shadow-card-hover transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: tier?.grad ?? "linear-gradient(135deg,#B76E79,#C4956A)" }}>
            {c.name.split(" ").map(n => n[0]).join("").slice(0,2)}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.phone}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary-500 transition-colors flex-shrink-0 mt-1" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{c.visits} visits</span>
          <span>·</span>
          <span>Rs.{c.totalSpent}</span>
        </div>
        {c.membership && (
          <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold border", tier?.pill)}>
            {c.membership}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[10px] text-muted-foreground">Last visit: {c.lastVisit}</p>
        {c.birthday && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Cake className="w-3 h-3" style={{ color:"#B76E79" }} /> {c.birthday}
          </span>
        )}
      </div>
    </button>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const { setAction } = useHeaderAction();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load customers from the database ──
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/customers");
        const json = await res.json();
        if (!active) return;
        if (json.success) setCustomers(json.data);
        else setLoadError(json.error || "Failed to load customers");
      } catch {
        if (active) setLoadError("Could not reach the server.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Surface "Add Customer" as the primary action in the top header bar
  useEffect(() => {
    setAction({ label: "Add Customer", onClick: () => setShowModal(true) });
    return () => setAction(null);
  }, [setAction]);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const q = search.trim().toLowerCase();
  const results = q
    ? customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q)
      )
    : [];

  const isSearching = q.length > 0;
  const showList    = isSearching || showAll;
  const displayList = isSearching ? results : customers;

  // ── Real stats from live data ──
  const memberCount = customers.filter(c => c.membership).length;
  const avgSpend = customers.length
    ? Math.round(customers.reduce((s, c) => s + (Number(String(c.totalSpent).replace(/,/g, "")) || 0), 0) / customers.length)
    : 0;

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setErr("Name and phone are required."); return; }
    setSubmitting(true); setErr("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { setErr(json.error || "Failed to add customer."); setSubmitting(false); return; }
      setCustomers(cs => [json.data, ...cs]);
      setShowModal(false);
      setForm(DEFAULT_FORM);
      setShowAll(true);
      toast.success(`${json.data.name} added`);
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:"Total",      value:customers.length.toString(),              sub:"customers",       icon:Users,       color:"#6366F1" },
          { label:"Members",    value:memberCount.toString(),                   sub:"Silver to Plat",  icon:Crown,       color:"#F59E0B" },
          { label:"Avg spend",  value:`Rs.${avgSpend.toLocaleString("en-IN")}`, sub:"per customer",    icon:TrendingUp,  color:"#B76E79" },
        ].map(s => (
          <div key={s.label} className="card-luxury p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:`${s.color}18` }}>
              <s.icon className="w-4 h-4" style={{ color:s.color }} />
            </div>
            <div>
              <p className="text-base font-display font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setShowAll(false); }}
          placeholder="Search by name, phone or email..."
          className="w-full pl-12 pr-10 py-3.5 rounded-2xl border border-ivory-300 bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all text-sm shadow-sm"
        />
        {search && (
          <button onClick={() => { setSearch(""); setShowAll(false); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-ivory-100 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color:"#B76E79" }} />
          <p className="text-sm text-muted-foreground">Loading customers from the database…</p>
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="text-sm text-red-500">{loadError}</p>
        </div>
      ) : showList ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isSearching
                ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${search}"`
                : `All ${customers.length} customers`}
            </p>
            {showAll && !isSearching && (
              <button onClick={() => setShowAll(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Collapse</button>
            )}
          </div>
          {displayList.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No customers found{isSearching ? <> for <strong>&ldquo;{search}&rdquo;</strong></> : ""}</p>
              <p className="text-xs text-muted-foreground mt-1">{isSearching ? "Try a different name, phone number or email" : "Add your first customer to get started"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayList.map(c => (
                <CustomerCard key={c.id} c={c} onClick={() => router.push(`/customers/${c.id}`)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10 space-y-4">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background:"linear-gradient(135deg,#FCF5F6,#F7E8EA)" }}>
            <Users className="w-7 h-7" style={{ color:"#B76E79" }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Search above to find a customer</p>
            <p className="text-xs text-muted-foreground mt-0.5">or</p>
          </div>
          <button onClick={() => setShowAll(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary-200 text-sm font-semibold transition-all hover:bg-primary-50"
            style={{ color:"#B76E79" }}>
            <Users className="w-4 h-4" />
            Browse all {customers.length} customers
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(20,12,14,0.82)", backdropFilter:"blur(4px)" }}
          onClick={e => { if (e.target===e.currentTarget && !submitting) { setShowModal(false); setErr(""); setForm(DEFAULT_FORM); } }}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">Add New Customer</h3>
              <button onClick={() => { setShowModal(false); setErr(""); setForm(DEFAULT_FORM); }} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Full Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Customer's full name" className={iCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Phone Number <span className="text-red-400">*</span></label>
                <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit mobile number" className={iCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Email Address</label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="customer@email.com" className={iCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Gender</label>
                  <select value={form.gender} onChange={e => set("gender", e.target.value)} className={iCls}>
                    <option value="">Select...</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Birthday</label>
                  <input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} className={iCls} />
                  <p className="text-[10px] text-muted-foreground mt-1">For birthday offers &amp; bonus points</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              <button onClick={() => { setShowModal(false); setErr(""); setForm(DEFAULT_FORM); }} className="flex-1 btn-outline text-sm py-2">Cancel</button>
              <button onClick={submit} disabled={submitting} className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving…" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
