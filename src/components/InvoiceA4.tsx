"use client";
import React from "react";
import { X, Printer, ExternalLink } from "lucide-react";

// ─── Shared data type ────────────────────────────────────────────────────────
export interface InvoiceItem {
  description: string;
  /** "Service" → SAC code; "Product" → HSN code */
  type:        "Service" | "Product";
  /** SAC / HSN code — e.g. 999721 for hair services, 3305 for hair products */
  hsnCode?:    string;
  amount:      number;
  detail?:     string;
}

export interface InvoiceData {
  invoiceNo:     string;
  date:          string;
  customer:      string;
  phone?:        string;
  stylist?:      string;
  stylistRole?:  string;
  items:         InvoiceItem[];
  subtotal:      number;
  discountAmt?:  number;
  discountLabel?:string;
  discountNote?: string;
  notes?:        string;
  cgst:          number;
  sgst:          number;
  halfGst:       number;
  total:         number;
  payMethod:     string;
  status:        "PAID" | "PARTIAL" | "PENDING" | "INFLUENCER";
  brandName?:    string;
  brandTagline?: string;
  brandAddress?: string;
  brandGstin?:   string;
  brandPhone?:   string;
  brandEmail?:   string;
  brandWebsite?: string;
  brandLogo?:    string | null;
}

// ─── HTML generator (for new-window print / standalone page) ─────────────────
export function generateInvoiceHTML(d: InvoiceData): string {
  const sColor = d.status==="PAID" ? "#059669" : d.status==="PARTIAL" ? "#2563EB" : d.status==="INFLUENCER" ? "#7C3AED" : "#DC2626";
  const sBg    = d.status==="PAID" ? "#D1FAE5"  : d.status==="PARTIAL" ? "#DBEAFE" : d.status==="INFLUENCER" ? "#EDE9FE" : "#FEE2E2";
  const sLabel = d.status==="PAID" ? "PAID"      : d.status==="PARTIAL" ? "PARTIAL PAYMENT" : d.status==="INFLUENCER" ? "INFLUENCER BARTER" : "PAYMENT PENDING";

  const hasServices = d.items.some(it => it.type === "Service");
  const hasProducts = d.items.some(it => it.type === "Product");
  const invoiceKind = hasServices && hasProducts ? "Tax Invoice (Services & Products)"
                    : hasProducts ? "Tax Invoice (Product Sale)"
                    : "Tax Invoice (Service)";

  const itemRows = d.items.map(it => {
    const typeBadge = it.type === "Service"
      ? `<span style="display:inline-block;font-size:9px;font-weight:700;padding:1px 7px;border-radius:999px;background:#FCE7EE;color:#111111;">SERVICE</span>`
      : `<span style="display:inline-block;font-size:9px;font-weight:700;padding:1px 7px;border-radius:999px;background:#FEF3C7;color:#92400E;">PRODUCT</span>`;
    const hsnLabel = it.type === "Service" ? "SAC" : "HSN";
    return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F3E8EA;vertical-align:top;width:55%;">
        <div style="font-size:13px;font-weight:600;color:#1a0f12;margin-bottom:3px;">${it.description}</div>
        ${it.detail ? `<div style="font-size:10.5px;color:#9A7A80;margin-bottom:2px;">${it.detail}</div>` : ""}
        <div>${typeBadge}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #F3E8EA;vertical-align:top;text-align:center;width:20%;">
        ${it.hsnCode ? `<div style="font-size:11px;font-family:monospace;font-weight:600;color:#4B5563;">${it.hsnCode}</div>
        <div style="font-size:8.5px;color:#9A7A80;margin-top:1px;">${hsnLabel} Code</div>` : `<div style="font-size:10px;color:#C4A0A8;">—</div>`}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #F3E8EA;text-align:right;font-size:13px;font-weight:600;color:#1a0f12;white-space:nowrap;vertical-align:top;width:25%;">
        &#8377;${it.amount.toLocaleString("en-IN")}
      </td>
    </tr>`;
  }).join("");

  const discRow = (d.discountAmt && d.discountAmt > 0) ? `
    <tr>
      <td style="padding:5px 0;font-size:12px;color:#059669;font-weight:600;">
        Discount${d.discountLabel ? ` (${d.discountLabel})` : ""}${d.discountNote ? ` — ${d.discountNote}` : ""}
      </td>
      <td></td>
      <td style="padding:5px 0;text-align:right;font-size:12px;color:#059669;font-weight:600;">
        − &#8377;${d.discountAmt.toLocaleString("en-IN")}
      </td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${d.invoiceNo} — ${d.brandName || "Lumi"}</title>
<style>
  @page { size:A4 portrait; margin:0; }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:white;color:#1a0f12;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;background:white;display:flex;flex-direction:column;}
  .hdr{background:linear-gradient(135deg,#0a0a0a 0%,#333333 55%,#555555 100%);padding:36px 44px 30px;}
  .hdr-name{color:white;font-size:28px;font-weight:900;letter-spacing:0.1em;margin-bottom:4px;}
  .hdr-tag{color:rgba(255,255,255,.65);font-size:10px;letter-spacing:0.28em;text-transform:uppercase;margin-bottom:6px;}
  .hdr-kind{display:inline-block;color:rgba(255,255,255,0.9);font-size:9.5px;font-weight:700;letter-spacing:0.1em;border:1px solid rgba(255,255,255,0.25);padding:3px 10px;border-radius:999px;margin-bottom:12px;}
  .hdr-contact{color:rgba(255,255,255,.5);font-size:9.5px;line-height:1.6;}
  .meta{display:flex;justify-content:space-between;align-items:center;padding:14px 44px;background:#fafafa;border-bottom:1px solid #e5e5e5;}
  .meta-lbl{font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:#9A7A80;margin-bottom:3px;}
  .meta-val{font-size:14px;font-weight:700;color:#1a0f12;}
  .status-pill{display:inline-block;padding:5px 16px;border-radius:999px;font-size:10px;font-weight:700;color:${sColor};background:${sBg};}
  .body{padding:30px 44px;flex:1;}
  .bill-row{display:flex;justify-content:space-between;margin-bottom:28px;padding-bottom:22px;border-bottom:1px solid #e5e5e5;}
  .bill-lbl{font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#9A7A80;margin-bottom:5px;}
  .bill-name{font-size:15px;font-weight:700;color:#1a0f12;margin-bottom:2px;}
  .bill-sub{font-size:11px;color:#6B7280;}
  table{width:100%;border-collapse:collapse;}
  .th{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#9A7A80;padding:8px 0;border-top:1px solid #e5e5e5;border-bottom:2px solid #e5e5e5;}
  .th-r{text-align:right;}
  .th-c{text-align:center;}
  .totals tr td{padding:5px 0;font-size:12px;color:#6B7280;}
  .totals tr td:last-child{text-align:right;font-weight:600;}
  .grand-total{border-top:2.5px solid #111111;margin-top:4px;}
  .grand-total td{padding:12px 0!important;font-size:17px!important;font-weight:800!important;color:#111111!important;}
  .grand-total td:last-child{text-align:right;}
  .pay-badge{display:flex;align-items:center;justify-content:space-between;margin-top:20px;padding:12px 18px;background:#D1FAE5;border:1px solid #A7F3D0;border-radius:10px;}
  .pay-badge span{font-size:12px;font-weight:700;color:#065F46;}
  .ftr{background:#fafafa;border-top:1px solid #e5e5e5;padding:18px 44px;text-align:center;}
  .ftr-title{font-size:13px;font-weight:800;color:#111111;margin-bottom:6px;}
  .ftr-sub{font-size:9.5px;color:#9A7A80;line-height:1.7;}
  @media print{ html,body{width:210mm;} .no-print{display:none!important;} }
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
      ${d.brandLogo 
        ? `<img src="${d.brandLogo}" style="height: 150px; max-width: 350px; object-fit: contain; margin-bottom: -25px; position: relative; left: -48px;" />` 
        : `<div>
             <div class="hdr-name">${d.brandName || "LUMI"}</div>
             <div class="hdr-tag">${d.brandTagline || "Where Beauty Meets Luxury"}</div>
           </div>`
      }
    </div>
    <div class="hdr-kind" style="margin-top: 12px;">${invoiceKind}</div>
    <div class="hdr-contact">
      GSTIN: ${d.brandGstin || "27AABCE1234F1Z5"} &nbsp;·&nbsp; ${d.brandAddress || "Shop 12, Luxury Mall, Bandra West, Mumbai 400050"}<br>
      Tel: ${d.brandPhone || "022-12345678"} &nbsp;·&nbsp; ${d.brandEmail || "hello@lumisalon.in"} &nbsp;·&nbsp; ${d.brandWebsite || "www.lumisalon.in"}
    </div>
  </div>

  <div class="meta">
    <div><div class="meta-lbl">Invoice No.</div><div class="meta-val">${d.invoiceNo}</div></div>
    <div><div class="meta-lbl">Date</div><div class="meta-val">${d.date}</div></div>
    <div><div class="meta-lbl">Status</div><span class="status-pill">${sLabel}</span></div>
  </div>

  <div class="body">
    <div class="bill-row">
      <div>
        <div class="bill-lbl">Bill To</div>
        <div class="bill-name">${d.customer}</div>
        ${d.phone ? `<div class="bill-sub">${d.phone}</div>` : ""}
      </div>
      ${d.stylist ? `
      <div style="text-align:right;">
        <div class="bill-lbl">Attended By</div>
        <div class="bill-name">${d.stylist}</div>
        ${d.stylistRole ? `<div class="bill-sub">${d.stylistRole}</div>` : ""}
      </div>` : ""}
    </div>

    <table>
      <thead>
        <tr>
          <th class="th" style="width:55%;text-align:left;">Description</th>
          <th class="th th-c" style="width:20%;">HSN / SAC</th>
          <th class="th th-r" style="width:25%;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <table class="totals" style="margin-top:0;">
      <colgroup><col style="width:55%"><col style="width:20%"><col style="width:25%"></colgroup>
      <tbody>
        <tr><td>Subtotal</td><td></td><td>&#8377;${d.subtotal.toLocaleString("en-IN")}</td></tr>
        ${discRow}
        <tr><td>CGST @ ${d.halfGst}%</td><td></td><td>&#8377;${d.cgst.toLocaleString("en-IN")}</td></tr>
        <tr><td>SGST @ ${d.halfGst}%</td><td></td><td>&#8377;${d.sgst.toLocaleString("en-IN")}</td></tr>
        <tr class="grand-total"><td>Grand Total</td><td></td><td>&#8377;${d.total.toLocaleString("en-IN")}</td></tr>
      </tbody>
    </table>

    <div class="pay-badge">
      <span>Payment received via ${d.payMethod}</span>
      <span>&#8377;${d.total.toLocaleString("en-IN")}</span>
    </div>

    ${d.notes ? `<div style="margin-top:14px;padding:10px 14px;background:#fafafa;border-radius:8px;border-left:3px solid #111111;font-size:11px;color:#5A3A40;line-height:1.6;"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:9px;color:#9A7A80;display:block;margin-bottom:3px;">Notes</span>${d.notes}</div>` : ""}
  </div>

  <div class="ftr">
    <div class="ftr-title">Thank you for visiting ${d.brandName || "Lumi"}!</div>
    <div class="ftr-sub">
      This is a computer-generated invoice and does not require a signature.<br>
      For queries, reach us at ${d.brandPhone || "022-12345678"} or ${d.brandEmail || "hello@lumisalon.in"}
    </div>
  </div>
  </div>
</div>
</body>
</html>`;
}

// ─── In-app A4 viewer overlay ─────────────────────────────────────────────────
export function InvoiceA4({ data, onClose, actions }: { data: InvoiceData; onClose: () => void; actions?: React.ReactNode }) {
  const sColor = data.status==="PAID" ? "#059669" : data.status==="PARTIAL" ? "#2563EB" : data.status==="INFLUENCER" ? "#7C3AED" : "#DC2626";
  const sBg    = data.status==="PAID" ? "#D1FAE5"  : data.status==="PARTIAL" ? "#DBEAFE" : data.status==="INFLUENCER" ? "#EDE9FE" : "#FEE2E2";
  const sLabel = data.status==="PAID" ? "PAID" : data.status==="PARTIAL" ? "PARTIAL" : data.status==="INFLUENCER" ? "BARTER" : "PENDING";

  const hasServices = data.items.some(it => it.type === "Service");
  const hasProducts = data.items.some(it => it.type === "Product");
  const invoiceKind = hasServices && hasProducts ? "Tax Invoice (Services & Products)"
                    : hasProducts ? "Tax Invoice (Product Sale)"
                    : "Tax Invoice (Service)";

  const openPrint = () => {
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) { alert("Please allow pop-ups to print/download the invoice."); return; }
    w.document.write(generateInvoiceHTML(data));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  const openTab = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(generateInvoiceHTML(data));
    w.document.close();
  };

  const discountAmt = data.discountAmt ?? 0;
  const TH: React.CSSProperties = { fontSize:"8px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.15em", color:"#9A7A80", padding:"8px 0", borderTop:"1px solid #e5e5e5", borderBottom:"2px solid #e5e5e5" };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background:"#0f0709" }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ background:"rgba(45,27,31,0.9)", borderBottom:"1px solid rgba(183,110,121,0.3)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:"#11111130" }}>
            <span className="text-xs" style={{ color:"#E8C5CB" }}>A4</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold">{data.invoiceNo}</p>
            <p className="text-xs" style={{ color:"#9A7A80" }}>{data.customer} · {data.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button onClick={openTab}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/20 text-white/80 hover:bg-white/10 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
          </button>
          <button onClick={openPrint}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background:"linear-gradient(135deg,#111111,#444444)" }}>
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </button>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── A4 Paper ── */}
      <div className="flex-1 overflow-auto py-8 px-4 flex justify-center" style={{ background:"#1a0f12" }}>
        <div style={{
          width:"210mm", minHeight:"297mm", background:"white",
          boxShadow:"0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(183,110,121,0.2)",
          display:"flex", flexDirection:"column",
        }}>
          {/* Header */}
          <div style={{ background:"linear-gradient(135deg,#0a0a0a 0%,#333333 55%,#555555 100%)", padding:"36px 44px 30px", position:"relative", overflow:"hidden" }}>
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
            <p style={{ display:"inline-block", color:"rgba(255,255,255,0.9)", fontSize:"9.5px", fontWeight:700, letterSpacing:"0.1em", border:"1px solid rgba(255,255,255,0.25)", padding:"3px 10px", borderRadius:"999px", marginBottom:"12px" }}>{invoiceKind}</p>
            <p style={{ color:"rgba(255,255,255,0.5)", fontSize:"9.5px", lineHeight:"1.7", display:"block" }}>
              GSTIN: {data.brandGstin || "27AABCE1234F1Z5"} &nbsp;·&nbsp; {data.brandAddress || "Shop 12, Luxury Mall, Bandra West, Mumbai 400050"}<br />
              Tel: {data.brandPhone || "022-12345678"} &nbsp;·&nbsp; {data.brandEmail || "hello@lumisalon.in"} &nbsp;·&nbsp; {data.brandWebsite || "www.lumisalon.in"}
            </p>
          </div>

          {/* Meta bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 44px", background:"#fafafa", borderBottom:"1px solid #e5e5e5" }}>
            {[{ lbl:"Invoice No.", val:data.invoiceNo }, { lbl:"Date", val:data.date }].map(m => (
              <div key={m.lbl}>
                <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.18em", color:"#9A7A80", marginBottom:"3px" }}>{m.lbl}</p>
                <p style={{ fontSize:"14px", fontWeight:700, color:"#1a0f12" }}>{m.val}</p>
              </div>
            ))}
            <div>
              <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.18em", color:"#9A7A80", marginBottom:"3px" }}>Status</p>
              <span style={{ display:"inline-block", padding:"4px 14px", borderRadius:"999px", fontSize:"10px", fontWeight:700, color:sColor, background:sBg }}>{sLabel}</span>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding:"30px 44px", flex:1 }}>
            {/* Bill To / Stylist */}
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"26px", paddingBottom:"22px", borderBottom:"1px solid #e5e5e5" }}>
              <div>
                <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.15em", color:"#9A7A80", marginBottom:"5px" }}>Bill To</p>
                <p style={{ fontSize:"15px", fontWeight:700, color:"#1a0f12", marginBottom:"2px" }}>{data.customer}</p>
                {data.phone && <p style={{ fontSize:"11px", color:"#6B7280" }}>{data.phone}</p>}
              </div>
              {data.stylist && (
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.15em", color:"#9A7A80", marginBottom:"5px" }}>Attended By</p>
                  <p style={{ fontSize:"15px", fontWeight:700, color:"#1a0f12", marginBottom:"2px" }}>{data.stylist}</p>
                  {data.stylistRole && <p style={{ fontSize:"11px", color:"#6B7280" }}>{data.stylistRole}</p>}
                </div>
              )}
            </div>

            {/* Items table */}
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign:"left", width:"55%" }}>Description</th>
                  <th style={{ ...TH, textAlign:"center", width:"20%" }}>HSN / SAC</th>
                  <th style={{ ...TH, textAlign:"right", width:"25%" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding:"10px 0", borderBottom:"1px solid #F3E8EA", verticalAlign:"top", width:"55%" }}>
                      <p style={{ fontSize:"13px", fontWeight:600, color:"#1a0f12", marginBottom:"3px" }}>{it.description}</p>
                      {it.detail && <p style={{ fontSize:"10.5px", color:"#9A7A80", marginBottom:"3px" }}>{it.detail}</p>}
                      <span style={{
                        display:"inline-block", fontSize:"9px", fontWeight:700, padding:"1px 7px", borderRadius:"999px",
                        background: it.type==="Service" ? "#FCE7EE" : "#FEF3C7",
                        color:       it.type==="Service" ? "#111111"  : "#92400E",
                      }}>{it.type.toUpperCase()}</span>
                    </td>
                    <td style={{ padding:"10px 0", borderBottom:"1px solid #F3E8EA", textAlign:"center", verticalAlign:"top", width:"20%" }}>
                      {it.hsnCode ? (
                        <>
                          <p style={{ fontSize:"11px", fontFamily:"monospace", fontWeight:600, color:"#374151" }}>{it.hsnCode}</p>
                          <p style={{ fontSize:"8.5px", color:"#9A7A80", marginTop:"2px" }}>{it.type==="Service" ? "SAC" : "HSN"}</p>
                        </>
                      ) : <p style={{ fontSize:"10px", color:"#C4A0A8" }}>—</p>}
                    </td>
                    <td style={{ padding:"10px 0", borderBottom:"1px solid #F3E8EA", textAlign:"right", fontSize:"13px", fontWeight:600, color:"#1a0f12", whiteSpace:"nowrap", verticalAlign:"top", width:"25%" }}>
                      ₹{it.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop:"1px solid #e5e5e5", marginTop:"4px" }}>
              {[
                { label:`Subtotal`, val:`₹${data.subtotal.toLocaleString("en-IN")}` },
                { label:`CGST @ ${data.halfGst}%`, val:`₹${data.cgst.toFixed(2)}` },
                { label:`SGST @ ${data.halfGst}%`, val:`₹${data.sgst.toFixed(2)}` },
              ].map(r => (
                <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:"12px", color:"#6B7280" }}>
                  <span>{r.label}</span><span style={{ fontWeight:600 }}>{r.val}</span>
                </div>
              ))}
              {data.discountAmt && data.discountAmt > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:"12px", color:"#059669", fontWeight:600 }}>
                  <span>Discount{data.discountNote ? ` — ${data.discountNote}` : ""}</span>
                  <span>− ₹{data.discountAmt.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0 4px", fontSize:"17px", fontWeight:800, color:"#111111", borderTop:"2.5px solid #111111", marginTop:"4px" }}>
                <span>Grand Total</span><span>₹{data.total.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Payment badge */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"20px", padding:"12px 18px", background:"#D1FAE5", border:"1px solid #A7F3D0", borderRadius:"10px" }}>
              <span style={{ fontSize:"12px", fontWeight:700, color:"#065F46" }}>Payment received via {data.payMethod}</span>
              <span style={{ fontSize:"12px", fontWeight:700, color:"#065F46" }}>₹{data.total.toLocaleString("en-IN")}</span>
            </div>

            {data.notes && (
              <div style={{ marginTop:"14px", padding:"10px 14px", background:"#fafafa", borderRadius:"8px", borderLeft:"3px solid #111111" }}>
                <span style={{ fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", fontSize:"9px", color:"#9A7A80", display:"block", marginBottom:"3px" }}>Notes</span>
                                <span style={{ fontSize:"11px", color:"#5A3A40", lineHeight:"1.6" }}>{data.notes}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ background:"#fafafa", borderTop:"1px solid #e5e5e5", padding:"18px 44px", textAlign:"center" as const }}>
            <p style={{ fontSize:"13px", fontWeight:800, color:"#111111", marginBottom:"6px" }}>Thank you for visiting {data.brandName || "Lumi"}!</p>
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
