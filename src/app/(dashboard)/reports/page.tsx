"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderAction } from "@/components/layout/HeaderActionContext";

// ─── Types ───────────────────────────────────────────────
type DailyRow    = { day:number; date:string; services:number; products:number; customers:number; method:string };
type WeeklyRow   = { week:string; services:number; products:number; customers:number; avgTicket:number };
type MonthlyRow  = { month:string; services:number; products:number; customers:number; avgTicket:number };
type YearlyRow   = { year:string; services:number; products:number; customers:number; avgTicket:number };
type ServiceRow  = { service:string; category:string; bookings:number; revenue:number; avgTicket:number; gst:number };
type ProductRow  = { product:string; category:string; unitsSold:number; revenue:number; avgPrice:number; gst:number; hsnCode:string|null };
type ReportData  = { daily:DailyRow[]; weekly:WeeklyRow[]; monthly:MonthlyRow[]; yearly:YearlyRow[]; service:ServiceRow[]; product:ProductRow[] };
type Tab = "sales" | "weekly" | "monthly" | "yearly" | "service" | "product";

const TABS: { id:Tab; label:string }[] = [
  { id:"sales",   label:"Sales Report" },
  { id:"weekly",  label:"Weekly Sales" },
  { id:"monthly", label:"Monthly Sales" },
  { id:"yearly",  label:"Yearly Sales" },
  { id:"service", label:"Service-wise" },
  { id:"product", label:"Product-wise" },
];

// ─── Helpers ──────────────────────────────────────────────
const fmt  = (n:number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtK = (n:number) => n >= 100000 ? `₹${(n/100000).toFixed(2)}L` : n >= 1000 ? `₹${(n/1000).toFixed(1)}K` : fmt(n);

function downloadCSV(filename:string, headers:string[], rows:(string|number)[][]) {
  const esc = (v:string|number) => { const s=String(v); return s.includes(",")||s.includes('"')?`"${s.replace(/"/g,'""')}"`:s; };
  const csv = [headers,...rows].map(r=>r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a = Object.assign(document.createElement("a"),{href:url,download:filename});
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

const CAT_COLOR: Record<string,string> = {
  Hair:"bg-violet-100 text-violet-700", Skin:"bg-rose-100 text-rose-700",
  Nails:"bg-pink-100 text-pink-700", Makeup:"bg-red-100 text-red-700",
  Body:"bg-orange-100 text-orange-700", Bridal:"bg-amber-100 text-amber-700",
  Kids:"bg-cyan-100 text-cyan-700", Wellness:"bg-teal-100 text-teal-700",
  "Hair Care":"bg-violet-100 text-violet-700", "Skin Care":"bg-rose-100 text-rose-700",
  "Nail Care":"bg-pink-100 text-pink-700",
};

const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS  = Array.from({length:4},(_,i)=>CURRENT_YEAR-3+i);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const EMPTY: ReportData = { daily:[], weekly:[], monthly:[], yearly:[], service:[], product:[] };

export default function ReportsPage() {
  const { setAction } = useHeaderAction();
  const [tab,     setTab]     = useState<Tab>("sales");
  const [year,    setYear]    = useState(CURRENT_YEAR);
  const [month,   setMonth]   = useState(CURRENT_MONTH);
  const [data,    setData]    = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/reports?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const ymLabel  = `${year}-${String(month).padStart(2,"0")}`;
  const MonthLabel = MONTHS[month-1].slice(0,3)+" "+year;

  const makeDownload = useCallback(() => {
    const D = data;
    switch (tab) {
      case "sales":
        downloadCSV(`sales_${ymLabel}.csv`,
          ["Date","Total Revenue","Services","Products","Customers","Payment Method"],
          D.daily.filter(d=>d.services+d.products>0).map(d=>[d.date,d.services+d.products,d.services,d.products,d.customers,d.method]));
        break;
      case "weekly":
        downloadCSV(`weekly_sales_${ymLabel}.csv`,
          ["Week","Services","Products","Total Revenue","Customers","Avg Ticket"],
          D.weekly.map(w=>[w.week,w.services,w.products,w.services+w.products,w.customers,w.avgTicket]));
        break;
      case "monthly":
        downloadCSV(`monthly_sales_${year}.csv`,
          ["Month","Services","Products","Total Revenue","Customers","Avg Ticket"],
          D.monthly.map(m=>[m.month,m.services,m.products,m.services+m.products,m.customers,m.avgTicket]));
        break;
      case "yearly":
        downloadCSV(`yearly_sales.csv`,
          ["Year","Services","Products","Total Revenue","Customers","Avg Ticket"],
          D.yearly.map(y=>[y.year,y.services,y.products,y.services+y.products,y.customers,y.avgTicket]));
        break;
      case "service":
        downloadCSV(`service_wise_${ymLabel}.csv`,
          ["Service","Category","Bookings","Revenue","Avg Ticket","GST%"],
          D.service.map(s=>[s.service,s.category,s.bookings,s.revenue,s.avgTicket,s.gst]));
        break;
      case "product":
        downloadCSV(`product_wise_${ymLabel}.csv`,
          ["Product","Category","HSN Code","Units Sold","Revenue","Avg Price","GST%"],
          D.product.map(p=>[p.product,p.category,p.hsnCode??"",p.unitsSold,p.revenue,p.avgPrice,p.gst]));
        break;
    }
  }, [tab, data, ymLabel, year]);

  useEffect(() => {
    setAction({ label: "Download CSV", variant: "outline", onClick: makeDownload });
    return () => setAction(null);
  }, [setAction, makeDownload]);

  const salesTotal    = data.daily.reduce((s,d)=>({rev:s.rev+d.services+d.products,svc:s.svc+d.services,prd:s.prd+d.products}),{rev:0,svc:0,prd:0});
  const salesCustomers= data.daily.reduce((s,d)=>s+d.customers,0);
  const showMonthPicker = tab !== "yearly" && tab !== "monthly";

  return (
    <div className="px-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-ivory-200 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={cn("px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              tab===t.id?"border-primary-500 text-primary-600":"border-transparent text-muted-foreground hover:text-foreground"
            )}>{t.label}</button>
        ))}
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        {showMonthPicker && (
          <select value={month} onChange={e=>setMonth(Number(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-xl border border-ivory-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 text-foreground">
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
        )}
        {tab !== "yearly" && (
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-xl border border-ivory-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 text-foreground">
            {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin" style={{color:"#111111"}}/>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{color:"#111111"}}/>
          <p className="text-sm text-muted-foreground">Loading report data…</p>
        </div>
      ) : (
        <>
          {/* ══ SALES REPORT (daily) ══ */}
          {tab==="sales" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {label:"Total Revenue",  value:fmtK(salesTotal.rev), sub:MonthLabel},
                  {label:"Service Revenue",value:fmtK(salesTotal.svc), sub:salesTotal.rev>0?`${((salesTotal.svc/salesTotal.rev)*100).toFixed(0)}% of total`:""},
                  {label:"Product Revenue",value:fmtK(salesTotal.prd), sub:salesTotal.rev>0?`${((salesTotal.prd/salesTotal.rev)*100).toFixed(0)}% of total`:""},
                  {label:"Total Customers",value:String(salesCustomers), sub:"Visits this period"},
                ].map(c=>(
                  <div key={c.label} className="card-luxury p-4">
                    <p className="text-xl font-display font-bold text-foreground">{c.value}</p>
                    <p className="text-xs font-semibold text-foreground mt-1">{c.label}</p>
                    <p className="text-[10px] text-muted-foreground">{c.sub}</p>
                  </div>
                ))}
              </div>
              {data.daily.length===0 ? (
                <div className="card-luxury p-12 text-center">
                  <p className="text-sm text-muted-foreground">No invoices found for {MonthLabel}.</p>
                </div>
              ) : (
                <div className="card-luxury overflow-hidden">
                  <div className="p-4 border-b border-ivory-200 bg-ivory-50">
                    <p className="text-sm font-semibold text-foreground">Daily Sales — {MonthLabel}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table-luxury w-full">
                      <thead>
                        <tr>
                          {["Date","Services","Products","Total","Customers","Payment"].map(h=>(
                            <th key={h} className={cn("py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground",
                              h==="Date"||h==="Payment"?"text-left":"text-right")}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily.map(d=>{
                          const total=d.services+d.products;
                          const closed=total===0;
                          return (
                            <tr key={d.day} className={cn("border-t border-ivory-100",closed?"opacity-40":"hover:bg-ivory-50")}>
                              <td className="py-2.5 px-4 text-xs font-medium text-foreground">{d.date}{closed&&<span className="ml-2 text-[10px] text-muted-foreground">(No sales)</span>}</td>
                              <td className="py-2.5 px-4 text-xs text-right text-foreground">{closed?"—":fmt(d.services)}</td>
                              <td className="py-2.5 px-4 text-xs text-right text-foreground">{closed?"—":fmt(d.products)}</td>
                              <td className="py-2.5 px-4 text-xs text-right font-bold" style={{color:closed?"inherit":"#111111"}}>{closed?"—":fmt(total)}</td>
                              <td className="py-2.5 px-4 text-xs text-right text-muted-foreground">{closed?"—":d.customers}</td>
                              <td className="py-2.5 px-4 text-xs text-muted-foreground">{d.method}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-ivory-300 bg-ivory-50">
                          <td className="py-3 px-4 text-xs font-bold text-foreground">TOTAL</td>
                          <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{fmt(salesTotal.svc)}</td>
                          <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{fmt(salesTotal.prd)}</td>
                          <td className="py-3 px-4 text-xs text-right font-bold" style={{color:"#111111"}}>{fmt(salesTotal.rev)}</td>
                          <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{salesCustomers}</td>
                          <td/>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ WEEKLY ══ */}
          {tab==="weekly" && (
            data.weekly.length===0 ? (
              <div className="card-luxury p-12 text-center"><p className="text-sm text-muted-foreground">No sales data for {MonthLabel}.</p></div>
            ) : (
              <div className="card-luxury overflow-hidden">
                <div className="p-4 border-b border-ivory-200 bg-ivory-50">
                  <p className="text-sm font-semibold text-foreground">Weekly Sales — {MonthLabel}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-luxury w-full">
                    <thead>
                      <tr>
                        {["Week","Services","Products","Total Revenue","Customers","Avg Ticket"].map(h=>(
                          <th key={h} className={cn("py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground",h==="Week"?"text-left":"text-right")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.weekly.map((w,i)=>{
                        const total=w.services+w.products;
                        const maxTotal=Math.max(...data.weekly.map(x=>x.services+x.products),1);
                        return (
                          <tr key={i} className="border-t border-ivory-100 hover:bg-ivory-50">
                            <td className="py-3 px-4">
                              <p className="text-sm font-semibold text-foreground">{w.week}</p>
                              <div className="mt-1.5 h-1.5 bg-ivory-200 rounded-full w-40">
                                <div className="h-1.5 rounded-full" style={{width:`${Math.round((total/maxTotal)*100)}%`,background:"#111111"}}/>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(w.services)}</td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(w.products)}</td>
                            <td className="py-3 px-4 text-sm text-right font-bold" style={{color:"#111111"}}>{fmt(total)}</td>
                            <td className="py-3 px-4 text-sm text-right text-muted-foreground">{w.customers}</td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(w.avgTicket)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ivory-300 bg-ivory-50">
                        <td className="py-3 px-4 text-xs font-bold text-foreground">TOTAL</td>
                        <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{fmt(data.weekly.reduce((s,w)=>s+w.services,0))}</td>
                        <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{fmt(data.weekly.reduce((s,w)=>s+w.products,0))}</td>
                        <td className="py-3 px-4 text-xs text-right font-bold" style={{color:"#111111"}}>{fmt(data.weekly.reduce((s,w)=>s+w.services+w.products,0))}</td>
                        <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{data.weekly.reduce((s,w)=>s+w.customers,0)}</td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ══ MONTHLY ══ */}
          {tab==="monthly" && (
            data.monthly.length===0 ? (
              <div className="card-luxury p-12 text-center"><p className="text-sm text-muted-foreground">No sales data for {year}.</p></div>
            ) : (
              <div className="card-luxury overflow-hidden">
                <div className="p-4 border-b border-ivory-200 bg-ivory-50">
                  <p className="text-sm font-semibold text-foreground">Monthly Sales — {year}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-luxury w-full">
                    <thead>
                      <tr>
                        {["Month","Services","Products","Total Revenue","Customers","Avg Ticket","vs Prev Month"].map(h=>(
                          <th key={h} className={cn("py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground",h==="Month"?"text-left":"text-right")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthly.map((m,i)=>{
                        const total=m.services+m.products;
                        const prev=i>0?data.monthly[i-1].services+data.monthly[i-1].products:null;
                        const growth=prev?((total-prev)/prev*100).toFixed(1):null;
                        return (
                          <tr key={i} className="border-t border-ivory-100 hover:bg-ivory-50">
                            <td className="py-3 px-4 text-sm font-semibold text-foreground">{m.month}</td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(m.services)}</td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(m.products)}</td>
                            <td className="py-3 px-4 text-sm text-right font-bold" style={{color:"#111111"}}>{fmtK(total)}</td>
                            <td className="py-3 px-4 text-sm text-right text-muted-foreground">{m.customers}</td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(m.avgTicket)}</td>
                            <td className="py-3 px-4 text-sm text-right font-semibold">
                              {growth?<span className={parseFloat(growth)>=0?"text-emerald-600":"text-red-500"}>{parseFloat(growth)>=0?"+":""}{growth}%</span>:<span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ivory-300 bg-ivory-50">
                        <td className="py-3 px-4 text-xs font-bold text-foreground">TOTAL ({year})</td>
                        <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{fmt(data.monthly.reduce((s,m)=>s+m.services,0))}</td>
                        <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{fmt(data.monthly.reduce((s,m)=>s+m.products,0))}</td>
                        <td className="py-3 px-4 text-xs text-right font-bold" style={{color:"#111111"}}>{fmtK(data.monthly.reduce((s,m)=>s+m.services+m.products,0))}</td>
                        <td className="py-3 px-4 text-xs text-right font-bold text-foreground">{data.monthly.reduce((s,m)=>s+m.customers,0)}</td>
                        <td colSpan={2}/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ══ YEARLY ══ */}
          {tab==="yearly" && (
            data.yearly.length===0 ? (
              <div className="card-luxury p-12 text-center"><p className="text-sm text-muted-foreground">No yearly data available yet.</p></div>
            ) : (
              <div className="card-luxury overflow-hidden">
                <div className="p-4 border-b border-ivory-200 bg-ivory-50">
                  <p className="text-sm font-semibold text-foreground">Yearly Sales</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Current year figures are year-to-date.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-luxury w-full">
                    <thead>
                      <tr>
                        {["Year","Services","Products","Total Revenue","Customers","Avg Ticket","YoY Growth"].map(h=>(
                          <th key={h} className={cn("py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground",h==="Year"?"text-left":"text-right")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.yearly.map((y,i)=>{
                        const total=y.services+y.products;
                        const prev=i>0?data.yearly[i-1].services+data.yearly[i-1].products:null;
                        const growth=prev?((total-prev)/prev*100).toFixed(1):null;
                        return (
                          <tr key={i} className="border-t border-ivory-100 hover:bg-ivory-50">
                            <td className="py-3 px-4 text-sm font-bold text-foreground">{y.year}</td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmtK(y.services)}</td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmtK(y.products)}</td>
                            <td className="py-3 px-4 text-sm text-right font-bold" style={{color:"#111111"}}>{fmtK(total)}</td>
                            <td className="py-3 px-4 text-sm text-right text-muted-foreground">{y.customers.toLocaleString("en-IN")}</td>
                            <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(y.avgTicket)}</td>
                            <td className="py-3 px-4 text-sm text-right font-semibold">
                              {growth?<span className={parseFloat(growth)>=0?"text-emerald-600":"text-red-500"}>{parseFloat(growth)>=0?"+":""}{growth}%</span>:<span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ══ SERVICE-WISE ══ */}
          {tab==="service" && (
            data.service.length===0 ? (
              <div className="card-luxury p-12 text-center"><p className="text-sm text-muted-foreground">No service sales found for {MonthLabel}.</p></div>
            ) : (
              <div className="card-luxury overflow-hidden">
                <div className="p-4 border-b border-ivory-200 bg-ivory-50">
                  <p className="text-sm font-semibold text-foreground">Service-wise Sales — {MonthLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ranked by revenue.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-luxury w-full">
                    <thead>
                      <tr>
                        {["#","Service","Category","Bookings","Revenue","Avg Ticket","GST%","Share"].map(h=>(
                          <th key={h} className={cn("py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground",
                            ["#","Service","Category"].includes(h)?"text-left":"text-right")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(()=>{
                        const totalRev=data.service.reduce((s,r)=>s+r.revenue,0)||1;
                        return data.service.map((s,i)=>{
                          const share=((s.revenue/totalRev)*100).toFixed(1);
                          return (
                            <tr key={i} className="border-t border-ivory-100 hover:bg-ivory-50">
                              <td className="py-3 px-4">
                                <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white" style={{background:i<3?"#111111":"#D9B5BC"}}>{i+1}</span>
                              </td>
                              <td className="py-3 px-4 text-sm font-medium text-foreground">{s.service}</td>
                              <td className="py-3 px-4">
                                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",CAT_COLOR[s.category]??"bg-ivory-100 text-muted-foreground")}>{s.category}</span>
                              </td>
                              <td className="py-3 px-4 text-sm text-right text-foreground">{s.bookings}</td>
                              <td className="py-3 px-4 text-sm text-right font-bold" style={{color:"#111111"}}>{fmt(s.revenue)}</td>
                              <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(s.avgTicket)}</td>
                              <td className="py-3 px-4 text-sm text-right text-muted-foreground">{s.gst}%</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <div className="w-16 h-1.5 bg-ivory-200 rounded-full">
                                    <div className="h-1.5 rounded-full" style={{width:`${share}%`,background:"#111111"}}/>
                                  </div>
                                  <span className="text-xs font-semibold text-muted-foreground">{share}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ivory-300 bg-ivory-50">
                        <td colSpan={4} className="py-3 px-4 text-xs font-bold text-foreground">TOTAL</td>
                        <td className="py-3 px-4 text-xs text-right font-bold" style={{color:"#111111"}}>{fmt(data.service.reduce((s,r)=>s+r.revenue,0))}</td>
                        <td colSpan={3}/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ══ PRODUCT-WISE ══ */}
          {tab==="product" && (
            data.product.length===0 ? (
              <div className="card-luxury p-12 text-center"><p className="text-sm text-muted-foreground">No product sales found for {MonthLabel}.</p></div>
            ) : (
              <div className="card-luxury overflow-hidden">
                <div className="p-4 border-b border-ivory-200 bg-ivory-50">
                  <p className="text-sm font-semibold text-foreground">Product-wise Sales — {MonthLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Retail product sales. HSN code included for GST filing.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-luxury w-full">
                    <thead>
                      <tr>
                        {["#","Product","Category","HSN Code","Units Sold","Avg Price","Revenue","GST%","Share"].map(h=>(
                          <th key={h} className={cn("py-3 px-4 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground",
                            ["#","Product","Category","HSN Code"].includes(h)?"text-left":"text-right")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(()=>{
                        const totalRev=data.product.reduce((s,r)=>s+r.revenue,0)||1;
                        return data.product.map((p,i)=>{
                          const share=((p.revenue/totalRev)*100).toFixed(1);
                          return (
                            <tr key={i} className="border-t border-ivory-100 hover:bg-ivory-50">
                              <td className="py-3 px-4">
                                <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white" style={{background:i<3?"#111111":"#D9B5BC"}}>{i+1}</span>
                              </td>
                              <td className="py-3 px-4 text-sm font-medium text-foreground">{p.product}</td>
                              <td className="py-3 px-4">
                                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",CAT_COLOR[p.category]??"bg-ivory-100 text-muted-foreground")}>{p.category}</span>
                              </td>
                              <td className="py-3 px-4">
                                {p.hsnCode?<span className="text-xs font-mono font-semibold text-muted-foreground bg-ivory-100 px-2 py-0.5 rounded-lg">{p.hsnCode}</span>:<span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="py-3 px-4 text-sm text-right text-foreground">{p.unitsSold}</td>
                              <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(p.avgPrice)}</td>
                              <td className="py-3 px-4 text-sm text-right font-bold" style={{color:"#444444"}}>{fmt(p.revenue)}</td>
                              <td className="py-3 px-4 text-sm text-right text-muted-foreground">{p.gst}%</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <div className="w-16 h-1.5 bg-ivory-200 rounded-full">
                                    <div className="h-1.5 rounded-full" style={{width:`${share}%`,background:"#444444"}}/>
                                  </div>
                                  <span className="text-xs font-semibold text-muted-foreground">{share}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ivory-300 bg-ivory-50">
                        <td colSpan={6} className="py-3 px-4 text-xs font-bold text-foreground">TOTAL</td>
                        <td className="py-3 px-4 text-xs text-right font-bold" style={{color:"#444444"}}>{fmt(data.product.reduce((s,r)=>s+r.revenue,0))}</td>
                        <td colSpan={2}/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
