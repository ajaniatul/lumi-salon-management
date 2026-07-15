"use client";
import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickedItem = { name: string; code: string; price: number; dbId: string };

type CatalogItem = {
  dbId: string;
  name: string;
  code: string;
  price: number;
  sub: string;
  badge: string;
  badgeCls: string;
};

interface Props {
  mode: "Service" | "Product";
  value: string;
  onSelect: (item: PickedItem) => void;
  iCls?: string;
}

const BASE = "w-full px-3 py-2 rounded-xl border border-ivory-300 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white";

export default function ItemPicker({ mode, value, onSelect, iCls }: Props) {
  const [query,   setQuery]   = useState(value);
  const [open,    setOpen]    = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Load services or products from DB when mode changes
  useEffect(() => {
    const url = mode === "Service" ? "/api/services" : "/api/products";
    fetch(url)
      .then(r => r.json())
      .then(j => {
        if (!j.success) return;
        if (mode === "Service") {
          setCatalog(j.data.map((s: any) => ({
            dbId: s.id,
            name: s.name,
            code: s.serviceCode ?? "999721",
            price: s.price,
            sub: `${s.category} · SAC 999721 · ${s.duration} min`,
            badge: "SERVICE",
            badgeCls: "bg-rose-50 text-rose-600",
          })));
        } else {
          setCatalog(j.data.map((p: any) => ({
            dbId: p.id,
            name: p.name,
            code: p.hsn ?? "3305",
            price: p.price,
            sub: `${p.brand ? p.brand + " · " : ""}${p.category} · HSN ${p.hsn ?? "3305"}`,
            badge: "PRODUCT",
            badgeCls: "bg-amber-50 text-amber-600",
          })));
        }
      })
      .catch(() => {});
  }, [mode]);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const results = catalog.filter(it =>
    it.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={mode === "Service" ? "Search service name or category…" : "Search product name or brand…"}
          className={cn(iCls ?? BASE, "pl-9")}
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-ivory-200 rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-ivory-100">
          {results.map((item, i) => (
            <button key={i} onMouseDown={() => {
              onSelect({ name: item.name, code: item.code, price: item.price, dbId: item.dbId });
              setQuery(item.name);
              setOpen(false);
            }}
              className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold", item.badgeCls)}>{item.badge}</span>
                  <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{item.sub}</p>
              </div>
              <span className="text-sm font-bold flex-shrink-0" style={{ color:"#111111" }}>
                Rs.{item.price.toLocaleString("en-IN")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
