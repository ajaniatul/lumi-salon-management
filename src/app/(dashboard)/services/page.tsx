"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock, Tag, Edit, Scissors, X, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";
import toast from "react-hot-toast";

type ServiceCat = string;

type Service = {
  id: string; code: string; name: string; cat: ServiceCat;
  price: number; duration: number; gst: number; desc: string; isActive: boolean;
};

const DEFAULT_SVC_CATS: ServiceCat[] = ["HAIR","SKIN","NAILS","MAKEUP","BODY","BRIDAL","KIDS","WELLNESS"];

const CAT_COLORS: Record<string, string> = {
  HAIR:     "bg-violet-100 text-violet-700",
  SKIN:     "bg-rose-100 text-rose-700",
  NAILS:    "bg-pink-100 text-pink-700",
  MAKEUP:   "bg-red-100 text-red-700",
  BODY:     "bg-orange-100 text-orange-700",
  BRIDAL:   "bg-amber-100 text-amber-700",
  KIDS:     "bg-sky-100 text-sky-700",
  WELLNESS: "bg-emerald-100 text-emerald-700",
};
function catColor(cat: string) {
  return CAT_COLORS[cat] ?? "bg-ivory-100 text-foreground";
}

const iCls = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";
const DEFAULT_FORM = { name: "", cat: "HAIR", price: "", duration: "", gst: "18", desc: "" };

export default function ServicesPage() {
  const router = useRouter();
  const { setAction } = useHeaderAction();

  const [services,    setServices]    = useState<Service[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [catFilter,   setCatFilter]   = useState("ALL");
  const [search,      setSearch]      = useState("");
  const [showModal,   setShowModal]   = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [form,        setForm]        = useState(DEFAULT_FORM);
  const [err,         setErr]         = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [allCats,     setAllCats]     = useState<ServiceCat[]>(DEFAULT_SVC_CATS);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/services?full=true").then(r => r.json()),
      fetch("/api/settings").then(r => r.json()),
    ]).then(([svc, set]) => {
      if (svc.success) setServices(svc.data);
      if (set.success && set.data?.serviceCategories?.length) setAllCats(set.data.serviceCategories);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setAction({ label: "Add Service", onClick: () => { setEditingId(null); setForm(DEFAULT_FORM); setErr(""); setShowModal(true); } });
    return () => setAction(null);
  }, [setAction]);

  const openEdit = (s: Service) => {
    setForm({ name: s.name, cat: s.cat, price: String(s.price), duration: String(s.duration), gst: String(s.gst), desc: s.desc });
    setEditingId(s.id);
    setErr("");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setErr(""); setForm(DEFAULT_FORM); };

  const deleteService = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (j.success) {
        toast.success(j.message || "Service deleted successfully.");
        closeModal();
        load();
      } else {
        toast.error(j.error || "Failed to delete service.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.price || !form.duration) {
      setErr("Name, price and duration are required."); return;
    }
    setSubmitting(true);
    try {
      const body   = { name: form.name, cat: form.cat, price: Number(form.price), duration: Number(form.duration), gst: Number(form.gst), desc: form.desc };
      const url    = editingId ? `/api/services/${editingId}` : "/api/services";
      const method = editingId ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j      = await res.json();
      if (j.success) { closeModal(); load(); }
      else setErr(j.error || "Failed to save service.");
    } catch { setErr("Network error."); }
    setSubmitting(false);
  };

  const activeCats = ["ALL", ...allCats.filter(c => services.some(s => s.cat === c))];

  const filtered = services.filter(s =>
    (catFilter === "ALL" || s.cat === catFilter) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const avgPrice    = services.length ? Math.round(services.reduce((a, s) => a + s.price, 0) / services.length) : 0;
  const avgDuration = services.length ? Math.round(services.reduce((a, s) => a + s.duration, 0) / services.length) : 0;
  const topCat      = services.length
    ? Object.entries(services.reduce((acc, s) => { acc[s.cat] = (acc[s.cat] || 0) + 1; return acc; }, {} as Record<string, number>))
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"
    : "—";

  return (
    <div className="px-6 space-y-5">

      {/* ── KPI chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Services",    value: loading ? "—" : services.length.toString(),                              desc: "Active in catalogue" },
          { label: "Avg. Price",        value: loading ? "—" : `₹${avgPrice.toLocaleString("en-IN")}`,                 desc: "Across all categories" },
          { label: "Avg. Duration",     value: loading ? "—" : `${avgDuration} min`,                                    desc: "Per service slot" },
          { label: "Largest Category",  value: loading ? "—" : topCat.charAt(0) + topCat.slice(1).toLowerCase(),       desc: "Most services listed" },
        ].map(s => (
          <div key={s.label} className="card-luxury p-4">
            <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-xs font-semibold text-foreground mt-1">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Search + category filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search services…" className="input-luxury pl-9 text-sm w-full" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {activeCats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={cn("text-xs px-3 py-1.5 rounded-lg font-medium transition-all",
                catFilter === c ? "bg-primary-500 text-white" : "bg-white border border-ivory-300 text-muted-foreground hover:border-primary-300"
              )}>
              {c === "ALL" ? "All" : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Service grid ── */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#111111" }} />
          <p className="text-sm text-muted-foreground">Loading services…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-luxury p-12 text-center">
          <p className="text-sm text-muted-foreground">No services found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="card-luxury p-5 group">
              <div className="flex items-start justify-between mb-3">
                <span className={cn("badge text-[10px]", catColor(s.cat))}>
                  {s.cat.charAt(0) + s.cat.slice(1).toLowerCase()}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">{s.code}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground">{s.name}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{s.desc || "—"}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />{s.duration} min
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="w-3.5 h-3.5" />GST {s.gst}%
                  </span>
                </div>
                <p className="text-base font-display font-bold" style={{ color: "#111111" }}>
                  ₹{s.price.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-ivory-200 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(s)}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-ivory-300 text-muted-foreground hover:bg-ivory-100 flex items-center justify-center gap-1">
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => router.push("/appointments")}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100 flex items-center justify-center gap-1">
                  <Scissors className="w-3 h-3" /> Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
              <h3 className="text-sm font-bold text-foreground">{editingId ? "Edit Service" : "Add Service"}</h3>
              <button onClick={closeModal} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Service Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => set("name", e.target.value)}
                  placeholder="e.g. Deep Conditioning Treatment" className={iCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Category <span className="text-red-400">*</span></label>
                  <select value={form.cat} onChange={e => set("cat", e.target.value)} className={iCls}>
                    {allCats.map(c => (
                      <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">GST %</label>
                  <select value={form.gst} onChange={e => set("gst", e.target.value)} className={iCls}>
                    <option value="5">5% (Reduced)</option>
                    <option value="18">18% (Standard)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Price (₹) <span className="text-red-400">*</span></label>
                  <input type="number" value={form.price} onChange={e => set("price", e.target.value)}
                    placeholder="0" className={iCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Duration (min) <span className="text-red-400">*</span></label>
                  <input type="number" value={form.duration} onChange={e => set("duration", e.target.value)}
                    placeholder="60" className={iCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Description</label>
                <textarea value={form.desc} onChange={e => set("desc", e.target.value)}
                  placeholder="What's included in this service…" rows={3}
                  className={iCls + " resize-none"} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 px-5 py-4 border-t border-ivory-200 bg-ivory-50">
              {editingId && (
                <button type="button" onClick={() => deleteService(editingId)} className="btn-outline border-red-300 text-red-500 hover:bg-red-50 text-sm py-2 px-3 flex items-center justify-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
              <div className="flex-1 flex gap-2">
                <button type="button" onClick={closeModal} className="flex-1 btn-outline text-sm py-2">Cancel</button>
                <button type="button" onClick={submit} disabled={submitting}
                  className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingId ? "Save Changes" : "Add Service"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
