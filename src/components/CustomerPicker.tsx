"use client";
import { useState, useRef, useEffect } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickedCustomer = { id: string; name: string; phone: string };

type DBCustomer = { id: string; name: string; phone: string; membership?: string | null };

interface Props {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
  placeholder?: string;
  iCls?: string;
}

const BASE = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";

export default function CustomerPicker({ value, onChange, placeholder = "Search customer name or phone…", iCls }: Props) {
  const [query,    setQuery]    = useState(value?.name ?? "");
  const [open,     setOpen]     = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);
  const [customers,setCustomers]= useState<DBCustomer[]>([]);
  const [newName,  setNewName]  = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding,   setAdding]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load customers from DB once
  useEffect(() => {
    fetch("/api/customers")
      .then(r => r.json())
      .then(j => { if (j.success) setCustomers(j.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { setQuery(value?.name ?? ""); }, [value]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)
  ).slice(0, 8);

  const select = (c: DBCustomer) => {
    onChange({ id: c.id, name: c.name, phone: c.phone });
    setQuery(c.name);
    setOpen(false);
    setShowAdd(false);
  };

  const addAndSelect = async () => {
    if (!newName.trim() || !newPhone.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/customers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newName.trim(), phone: newPhone.trim() }),
      });
      const j = await res.json();
      if (j.success) {
        const c = { id: j.data.id, name: j.data.name, phone: j.data.phone };
        setCustomers(prev => [c, ...prev]);
        select(c);
        setNewName(""); setNewPhone("");
      }
    } catch {}
    setAdding(false);
  };

  const clear = () => { onChange(null); setQuery(""); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(iCls ?? BASE, "pl-9 pr-8")}
        />
        {value && (
          <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-ivory-200 rounded-2xl shadow-2xl overflow-hidden">
          {filtered.length > 0 ? (
            <div className="max-h-48 overflow-y-auto divide-y divide-ivory-100">
              {filtered.map((c, i) => (
                <button key={c.id ?? i} onMouseDown={() => select(c)}
                  className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background:"#111111" }}>
                    {c.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.phone}{c.membership ? ` · ${c.membership}` : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground px-3 py-3">{query ? "No customers found" : "Start typing to search…"}</p>
          )}

          {!showAdd ? (
            <button onMouseDown={() => setShowAdd(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold border-t border-ivory-200 hover:bg-violet-50 transition-colors"
              style={{ color:"#7C3AED" }}>
              <UserPlus className="w-3.5 h-3.5" /> Add New Customer
            </button>
          ) : (
            <div className="border-t border-ivory-200 p-3 space-y-2 bg-violet-50">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color:"#7C3AED" }}>New Customer</p>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Full name"
                className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-violet-300" />
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="Phone number" type="tel"
                className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-violet-300" />
              <div className="flex gap-2">
                <button onMouseDown={() => { setShowAdd(false); setNewName(""); setNewPhone(""); }}
                  className="flex-1 py-1.5 rounded-lg border border-violet-200 text-xs text-muted-foreground bg-white hover:bg-gray-50">
                  Cancel
                </button>
                <button onMouseDown={addAndSelect} disabled={adding}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background:"#7C3AED" }}>
                  {adding ? "Saving…" : "Add & Select"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
