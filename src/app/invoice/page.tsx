"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { InvoiceA4, generateInvoiceHTML, InvoiceData } from "@/components/InvoiceA4";
import { Printer, ExternalLink } from "lucide-react";

// Demo data shown when no query params are present
const DEMO: InvoiceData = {
  invoiceNo:     "INV-2026-0049",
  date:          new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }),
  customer:      "Anjali Mehta",
  phone:         "9988776655",
  stylist:       "Ananya Sharma",
  stylistRole:   "Senior Stylist",
  items:         [
    { description:"Hair Coloring — Global", type:"Service", amount:2500, detail:"Wella shade 6/0 · 120 min · 10:00 AM – 12:00 PM" },
  ],
  subtotal:      2118,
  discountAmt:   250,
  discountLabel: "10% Gold Member",
  discountNote:  "Loyalty discount for Gold tier",
  cgst:          168,
  sgst:          168,
  halfGst:       9,
  total:         2500,
  payMethod:     "UPI",
  status:        "PAID",
  loyaltyPoints: 25,
};

function InvoiceViewer() {
  const params = useSearchParams();
  const raw    = params.get("d");
  let data: InvoiceData = DEMO;
  try {
    if (raw) data = JSON.parse(atob(raw)) as InvoiceData;
  } catch {}

  const openPrint = () => {
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(generateInvoiceHTML(data));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  const sColor = data.status==="PAID" ? "#059669" : data.status==="PARTIAL" ? "#2563EB" : "#DC2626";
  const sBg    = data.status==="PAID" ? "#D1FAE5"  : data.status==="PARTIAL" ? "#DBEAFE" : "#FEE2E2";
  const sLabel = data.status==="PAID" ? "PAID" : data.status==="PARTIAL" ? "PARTIAL" : "PENDING";
  const discountAmt = data.discountAmt ?? 0;

  return (
    <div style={{ minHeight:"100vh", background:"#1a0f12", display:"flex", flexDirection:"column" }}>
      {/* Toolbar */}
      <div style={{ background:"rgba(45,27,31,0.95)", borderBottom:"1px solid rgba(183,110,121,0.3)", padding:"12px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ background:"rgba(183,110,121,0.2)", padding:"6px 12px", borderRadius:"8px" }}>
            <span style={{ color:"#E8C5CB", fontSize:"11px", fontWeight:700, letterSpacing:"0.1em" }}>LUMI</span>
          </div>
          <div>
            <p style={{ color:"white", fontSize:"13px", fontWeight:600 }}>{data.invoiceNo}</p>
            <p style={{ color:"#9A7A80", fontSize:"11px" }}>{data.customer} · {data.date}</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={openPrint}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 18px", borderRadius:"10px", background:"linear-gradient(135deg,#B76E79,#C4956A)", color:"white", fontSize:"12px", fontWeight:700, border:"none", cursor:"pointer" }}>
            <Printer style={{ width:"14px", height:"14px" }} />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* A4 Paper */}
      <div style={{ flex:1, overflowY:"auto", padding:"40px 16px", display:"flex", justifyContent:"center" }}>
        <div style={{ width:"210mm", minHeight:"297mm", background:"white", boxShadow:"0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(183,110,121,0.2)", display:"flex", flexDirection:"column" }}>

          {/* Header */}
          <div style={{ background:"linear-gradient(135deg,#2D1B1F 0%,#B76E79 55%,#C4956A 100%)", padding:"36px 44px 30px" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:"8px", marginBottom:"0px" }}>
              {data.brandLogo ? (
                <img src={data.brandLogo} style={{ height:"150px", maxWidth:"350px", objectFit:"contain", position:"relative", left:"-48px", marginBottom:"-25px" }} alt="Logo" />
              ) : (
                <div>
                  <p style={{ color:"white", fontSize:"26px", fontWeight:900, letterSpacing:"0.1em", marginBottom:"4px" }}>{data.brandName || "LUMI"}</p>
                  <p style={{ color:"rgba(255,255,255,0.65)", fontSize:"10px", letterSpacing:"0.28em", textTransform:"uppercase" as const, marginBottom:"0px" }}>{data.brandTagline || "Where Beauty Meets Luxury"}</p>
                </div>
              )}
            </div>
            <p style={{ color:"rgba(255,255,255,0.5)", fontSize:"9.5px", lineHeight:"1.7", display:"block" }}>
              GSTIN: {data.brandGstin || "27AABCE1234F1Z5"} &nbsp;·&nbsp; {data.brandAddress || "Shop 12, Luxury Mall, Bandra West, Mumbai 400050"}<br />
              Tel: {data.brandPhone || "022-12345678"} &nbsp;·&nbsp; {data.brandEmail || "hello@lumisalon.in"} &nbsp;·&nbsp; {data.brandWebsite || "www.lumisalon.in"}
            </p>
          </div>

          {/* Meta bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 44px", background:"#FCF5F6", borderBottom:"1px solid #EDD0D4" }}>
            {[{ lbl:"Invoice No.", val:data.invoiceNo }, { lbl:"Date", val:data.date }].map(m => (
              <div key={m.lbl}>
                <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.18em", color:"#9A7A80", marginBottom:"3px" }}>{m.lbl}</p>
                <p style={{ fontSize:"14px", fontWeight:700, color:"#1a0f12" }}>{m.val}</p>
              </div>
            ))}
            <div>
              <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.18em", color:"#9A7A80", marginBottom:"3px" }}>Status</p>
              <span style={{ display:"inline-block", padding:"4px 14px", borderRadius:"999px", fontSize:"10px", fontWeight:700, color:sColor, background:sBg }}>{sLabel}</span>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding:"30px 44px", flex:1 }}>
            {/* Bill To */}
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"26px", paddingBottom:"22px", borderBottom:"1px solid #EDD0D4" }}>
              <div>
                <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.15em", color:"#9A7A80", marginBottom:"5px" }}>Bill To</p>
                <p style={{ fontSize:"15px", fontWeight:700, color:"#1a0f12", marginBottom:"2px" }}>{data.customer}</p>
                {data.phone && <p style={{ fontSize:"11px", color:"#6B7280" }}>{data.phone}</p>}
              </div>
              {data.stylist && (
                <div style={{ textAlign:"right" as const }}>
                  <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.15em", color:"#9A7A80", marginBottom:"5px" }}>Attended By</p>
                  <p style={{ fontSize:"15px", fontWeight:700, color:"#1a0f12", marginBottom:"2px" }}>{data.stylist}</p>
                  {data.stylistRole && <p style={{ fontSize:"11px", color:"#6B7280" }}>{data.stylistRole}</p>}
                </div>
              )}
            </div>

            {/* Items header */}
            <div style={{ display:"flex", justifyContent:"space-between", paddingBottom:"8px", borderTop:"1px solid #EDD0D4", borderBottom:"2px solid #EDD0D4", marginBottom:"4px" }}>
              {["Description","Amount"].map(h => (
                <span key={h} style={{ fontSize:"8px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.15em", color:"#9A7A80" }}>{h}</span>
              ))}
            </div>

            {/* Line items */}
            {data.items.map((it, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"10px 0", borderBottom:"1px solid #F3E8EA" }}>
                <div>
                  <p style={{ fontSize:"13px", fontWeight:600, color:"#1a0f12" }}>{it.description}</p>
                  {it.detail && <p style={{ fontSize:"10.5px", color:"#9A7A80", marginTop:"2px" }}>{it.detail}</p>}
                  <p style={{ fontSize:"10px", color:"#C4A0A8", marginTop:"1px" }}>{it.type}</p>
                </div>
                <p style={{ fontSize:"13px", fontWeight:600, color:"#1a0f12", whiteSpace:"nowrap" as const }}>Rs.{it.amount.toLocaleString("en-IN")}</p>
              </div>
            ))}

            {/* Totals */}
            <div style={{ borderTop:"1px solid #EDD0D4", marginTop:"4px" }}>
              {[
                { label:"Subtotal", value:`Rs.${data.subtotal.toLocaleString("en-IN")}`, color:"#6B7280" },
                ...(discountAmt > 0 ? [{ label:`Discount${data.discountLabel ? ` (${data.discountLabel})` : ""}${data.discountNote ? ` — ${data.discountNote}` : ""}`, value:`− Rs.${discountAmt.toLocaleString("en-IN")}`, color:"#059669" }] : []),
                { label:`CGST @ ${data.halfGst}%`, value:`Rs.${data.cgst.toLocaleString("en-IN")}`, color:"#6B7280" },
                { label:`SGST @ ${data.halfGst}%`, value:`Rs.${data.sgst.toLocaleString("en-IN")}`, color:"#6B7280" },
              ].map((r, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0" }}>
                  <span style={{ fontSize:"12px", color:r.color }}>{r.label}</span>
                  <span style={{ fontSize:"12px", fontWeight:600, color:r.color }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", borderTop:"2.5px solid #B76E79", marginTop:"4px" }}>
                <span style={{ fontSize:"17px", fontWeight:800, color:"#B76E79" }}>Grand Total</span>
                <span style={{ fontSize:"17px", fontWeight:800, color:"#B76E79" }}>Rs.{data.total.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"20px", padding:"12px 18px", background:"#D1FAE5", border:"1px solid #A7F3D0", borderRadius:"10px" }}>
              <span style={{ fontSize:"12px", fontWeight:700, color:"#065F46" }}>Payment received via {data.payMethod}</span>
              <span style={{ fontSize:"12px", fontWeight:700, color:"#065F46" }}>Rs.{data.total.toLocaleString("en-IN")}</span>
            </div>

            {data.loyaltyPoints && (
              <p style={{ textAlign:"center" as const, marginTop:"16px", fontSize:"11px", color:"#C4956A", fontWeight:600 }}>
                ✦ {data.loyaltyPoints} loyalty points credited to {data.customer.split(" ")[0]}&apos;s account
              </p>
            )}
          </div>

          {/* Footer */}
          <div style={{ background:"#FCF5F6", borderTop:"1px solid #EDD0D4", padding:"18px 44px", textAlign:"center" as const }}>
            <p style={{ fontSize:"13px", fontWeight:800, color:"#B76E79", marginBottom:"6px" }}>Thank you for visiting {data.brandName || "Lumi"}!</p>
            <p style={{ fontSize:"9.5px", color:"#9A7A80", lineHeight:"1.7" }}>
              This is a computer-generated invoice and does not require a signature.<br />
              For queries, reach us at {data.brandPhone || "022-12345678"} or {data.brandEmail || "hello@lumisalon.in"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100vh", background:"#1a0f12", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <p style={{ color:"#9A7A80", fontSize:"14px" }}>Loading invoice...</p>
      </div>
    }>
      <InvoiceViewer />
    </Suspense>
  );
}
