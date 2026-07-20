"use client";
import React from "react";
import { X, Printer, ExternalLink } from "lucide-react";

export interface InvoiceItem {
  description: string;
  type:        "Service" | "Product";
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

// ─── HTML generator ───────────────────────────────────────────────────────────
export function generateInvoiceHTML(d: InvoiceData): string {
  const sColor = d.status==="PAID" ? "#059669" : d.status==="PARTIAL" ? "#2563EB" : d.status==="INFLUENCER" ? "#7C3AED" : "#DC2626";
  const sBg    = d.status==="PAID" ? "#D1FAE5"  : d.status==="PARTIAL" ? "#DBEAFE" : d.status==="INFLUENCER" ? "#EDE9FE" : "#FEE2E2";
  const sLabel = d.status==="PAID" ? "PAID" : d.status==="PARTIAL" ? "PARTIAL PAYMENT" : d.status==="INFLUENCER" ? "INFLUENCER BARTER" : "PAYMENT PENDING";

  const hasServices = d.items.some(it => it.type === "Service");
  const hasProducts = d.items.some(it => it.type === "Product");
  const invoiceKind = hasServices && hasProducts ? "Tax Invoice (Services & Products)"
                    : hasProducts ? "Tax Invoice (Product Sale)"
                    : "Tax Invoice (Service)";

  const itemRows = d.items.map(it => {
    const hsnLabel = it.type === "Service" ? "SAC" : "HSN";
    return `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid #f0e8ea;vertical-align:top;">
        <div style="font-size:11px;font-weight:600;color:#1a0f12;margin-bottom:2px;">${it.description}</div>
        ${it.detail ? `<div style="font-size:9px;color:#9A7A80;">${it.detail}</div>` : ""}
        ${it.hsnCode ? `<div style="font-size:8.5px;color:#9A7A80;">${hsnLabel}: ${it.hsnCode}</div>` : ""}
      </td>
      <td style="padding:7px 0;border-bottom:1px solid #f0e8ea;text-align:right;font-size:11px;font-weight:600;color:#1a0f12;white-space:nowrap;vertical-align:top;min-width:60px;">
        &#8377;${it.amount.toLocaleString("en-IN")}
      </td>
    </tr>`;
  }).join("");

  const discRow = (d.discountAmt && d.discountAmt > 0) ? `
    <tr>
      <td style="padding:4px 0;font-size:10px;color:#059669;font-weight:600;">Discount${d.discountNote ? ` — ${d.discountNote}` : ""}</td>
      <td style="padding:4px 0;text-align:right;font-size:10px;color:#059669;font-weight:600;">− &#8377;${d.discountAmt.toLocaleString("en-IN")}</td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${d.invoiceNo} — ${d.brandName || "Salon"}</title>
<style>
  @page { size:80mm 210mm; margin:0; }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:white;color:#1a0f12;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:80mm;min-height:210mm;background:white;display:flex;flex-direction:column;}
  .hdr{background:#fff;padding:10px 10px 8px;border-bottom:1.5px solid #111;text-align:center;}
  .divider{border:none;border-top:1px dashed #ccc;margin:6px 0;}
  .row{display:flex;justify-content:space-between;align-items:baseline;}
  .lbl{font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9A7A80;}
  .val{font-size:11px;font-weight:700;color:#1a0f12;}
  .section{padding:8px 10px;border-bottom:1px dashed #e0d8da;}
  table{width:100%;border-collapse:collapse;}
  .totals td{padding:3px 0;font-size:10px;color:#555;}
  .totals td:last-child{text-align:right;font-weight:600;}
  .grand td{padding:6px 0 3px!important;font-size:14px!important;font-weight:800!important;color:#111!important;border-top:1.5px solid #111;margin-top:3px;}
  .grand td:last-child{text-align:right;}
  .ftr{padding:10px;text-align:center;border-top:1px dashed #ccc;}
  @media print{ html,body{width:80mm;} .no-print{display:none!important;} }
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    ${d.brandLogo
      ? `<div style="max-width:74mm;height:155px;overflow:hidden;margin:0 auto;"><img src="${d.brandLogo}" style="width:100%;height:auto;display:block;" /></div>`
      : `<div style="font-size:20px;font-weight:900;letter-spacing:0.08em;color:#111;margin-bottom:3px;">${d.brandName || "SALON"}</div>
         <div style="font-size:7.5px;letter-spacing:0.2em;text-transform:uppercase;color:#777;margin-bottom:5px;">${d.brandTagline || ""}</div>`
    }
    <div style="font-size:7.5px;color:#666;line-height:1.5;margin-bottom:5px;">
      ${d.brandAddress || ""}<br>
      Tel: ${d.brandPhone || ""} / 9995818169<br>
      GSTIN: ${d.brandGstin || ""}
    </div>
    <div style="display:inline-block;font-size:8px;font-weight:700;letter-spacing:0.08em;border:1px solid #111;padding:2px 8px;border-radius:999px;">${invoiceKind}</div>
  </div>

  <div class="section">
    <div class="row" style="margin-bottom:5px;">
      <div><div class="lbl">Invoice No.</div><div class="val">${d.invoiceNo}</div></div>
      <div style="text-align:right;"><div class="lbl">Date</div><div class="val">${d.date}</div></div>
    </div>
    <div class="row">
      <div><div class="lbl">Status</div>
        <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:9px;font-weight:700;color:${sColor};background:${sBg};">${sLabel}</span>
      </div>
      <div style="text-align:right;"><div class="lbl">Payment</div><div style="font-size:10px;font-weight:600;color:#374151;">${d.payMethod}</div></div>
    </div>
  </div>

  <div class="section">
    <div style="display:flex;justify-content:space-between;gap:8px;">
      <div>
        <div class="lbl" style="margin-bottom:3px;">Bill To</div>
        <div style="font-size:12px;font-weight:700;color:#1a0f12;">${d.customer}</div>
        ${d.phone ? `<div style="font-size:10px;color:#6B7280;">${d.phone}</div>` : ""}
      </div>
      ${d.stylist ? `<div style="text-align:right;">
        <div class="lbl" style="margin-bottom:3px;">Attended By</div>
        <div style="font-size:11px;font-weight:700;color:#1a0f12;">${d.stylist}</div>
        ${d.stylistRole ? `<div style="font-size:9px;color:#6B7280;">${d.stylistRole}</div>` : ""}
      </div>` : ""}
    </div>
  </div>

  <div style="padding:8px 10px;flex:1;">
    <table>
      <thead>
        <tr>
          <th style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9A7A80;padding:5px 0;border-bottom:1.5px solid #111;text-align:left;">Item</th>
          <th style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9A7A80;padding:5px 0;border-bottom:1.5px solid #111;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <hr class="divider" style="margin-top:4px;">
    <table class="totals" style="margin-top:2px;">
      <tbody>
        <tr><td>Subtotal</td><td>&#8377;${d.subtotal.toLocaleString("en-IN")}</td></tr>
        ${discRow}
        <tr><td>CGST @ ${d.halfGst}%</td><td>&#8377;${d.cgst.toFixed(2)}</td></tr>
        <tr><td>SGST @ ${d.halfGst}%</td><td>&#8377;${d.sgst.toFixed(2)}</td></tr>
        <tr class="grand"><td>Grand Total</td><td>&#8377;${d.total.toLocaleString("en-IN")}</td></tr>
      </tbody>
    </table>

    ${d.notes ? `<div style="margin-top:8px;padding:6px 8px;background:#fafafa;border-radius:4px;border-left:2px solid #111;font-size:9px;color:#5A3A40;line-height:1.6;"><span style="font-weight:700;text-transform:uppercase;font-size:7.5px;color:#9A7A80;display:block;margin-bottom:2px;">Notes</span>${d.notes}</div>` : ""}
  </div>

  <div class="ftr">
    <div style="font-size:10px;font-weight:800;color:#111;margin-bottom:4px;">Thank you for visiting ${d.brandName || "us"}!</div>
    <div style="font-size:8px;color:#9A7A80;line-height:1.7;">
      Computer-generated invoice. No signature required.<br>
      ${d.brandEmail || ""} &nbsp;|&nbsp; ${d.brandWebsite || ""}
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── In-app slip viewer overlay ───────────────────────────────────────────────
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
    const w = window.open("", "_blank", "width=400,height=700");
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

  const S: React.CSSProperties = { fontFamily:"'Segoe UI',Tahoma,Geneva,Verdana,sans-serif" };
  const lbl: React.CSSProperties = { fontSize:"7px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", color:"#9A7A80", marginBottom:"2px" };
  const val: React.CSSProperties = { fontSize:"11px", fontWeight:700, color:"#1a0f12" };
  const sec: React.CSSProperties = { padding:"8px 12px", borderBottom:"1px dashed #e0d8da" };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background:"#0f0709" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ background:"rgba(45,27,31,0.9)", borderBottom:"1px solid rgba(183,110,121,0.3)" }}>
        <div className="flex items-center gap-3">
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

      {/* Slip viewer */}
      <div className="flex-1 overflow-auto py-8 px-4 flex justify-center" style={{ background:"#1a0f12" }}>
        <div style={{
          ...S,
          width:"302px", background:"white",
          boxShadow:"0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(183,110,121,0.2)",
          display:"flex", flexDirection:"column",
        }}>
          {/* Header */}
          <div style={{ background:"#fff", padding:"10px 12px 8px", borderBottom:"1.5px solid #111", textAlign:"center" as const }}>
            {data.brandLogo ? (
              <div style={{ maxWidth:"280px", height:"155px", overflow:"hidden", margin:"0 auto" }}>
                <img src={data.brandLogo} style={{ width:"100%", height:"auto", display:"block" }} alt="Logo" />
              </div>
            ) : (
              <>
                <p style={{ fontSize:"20px", fontWeight:900, letterSpacing:"0.08em", color:"#111", marginBottom:"3px" }}>{data.brandName || "SALON"}</p>
                {data.brandTagline && <p style={{ fontSize:"7.5px", letterSpacing:"0.2em", textTransform:"uppercase" as const, color:"#777", marginBottom:"5px" }}>{data.brandTagline}</p>}
              </>
            )}
            <p style={{ fontSize:"7.5px", color:"#666", lineHeight:"1.5", marginBottom:"5px" }}>
              {data.brandAddress}<br />
              Tel: {data.brandPhone || ""} / 9995818169<br />
              GSTIN: {data.brandGstin || ""}
            </p>
            <span style={{ display:"inline-block", fontSize:"8px", fontWeight:700, letterSpacing:"0.08em", border:"1px solid #111", padding:"2px 8px", borderRadius:"999px" }}>{invoiceKind}</span>
          </div>

          {/* Invoice meta */}
          <div style={{ ...sec }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
              <div><div style={lbl}>Invoice No.</div><div style={val}>{data.invoiceNo}</div></div>
              <div style={{ textAlign:"right" }}><div style={lbl}>Date</div><div style={val}>{data.date}</div></div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={lbl}>Status</div>
                <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:"999px", fontSize:"9px", fontWeight:700, color:sColor, background:sBg }}>{sLabel}</span>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={lbl}>Payment</div>
                <div style={{ fontSize:"10px", fontWeight:600, color:"#374151" }}>{data.payMethod}</div>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div style={{ ...sec }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:"8px" }}>
              <div>
                <div style={{ ...lbl, marginBottom:"3px" }}>Bill To</div>
                <div style={{ fontSize:"12px", fontWeight:700, color:"#1a0f12" }}>{data.customer}</div>
                {data.phone && <div style={{ fontSize:"10px", color:"#6B7280" }}>{data.phone}</div>}
              </div>
              {data.stylist && (
                <div style={{ textAlign:"right" as const }}>
                  <div style={{ ...lbl, marginBottom:"3px" }}>Attended By</div>
                  <div style={{ fontSize:"11px", fontWeight:700, color:"#1a0f12" }}>{data.stylist}</div>
                  {data.stylistRole && <div style={{ fontSize:"9px", color:"#6B7280" }}>{data.stylistRole}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div style={{ padding:"8px 12px", flex:1 }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.12em", color:"#9A7A80", padding:"5px 0", borderBottom:"1.5px solid #111", textAlign:"left" as const }}>Item</th>
                  <th style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.12em", color:"#9A7A80", padding:"5px 0", borderBottom:"1.5px solid #111", textAlign:"right" as const }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding:"7px 0", borderBottom:"1px solid #f0e8ea", verticalAlign:"top" }}>
                      <p style={{ fontSize:"11px", fontWeight:600, color:"#1a0f12", marginBottom:"2px" }}>{it.description}</p>
                      {it.detail && <p style={{ fontSize:"9px", color:"#9A7A80" }}>{it.detail}</p>}
                      {it.hsnCode && <p style={{ fontSize:"8.5px", color:"#9A7A80" }}>{it.type==="Service" ? "SAC" : "HSN"}: {it.hsnCode}</p>}
                    </td>
                    <td style={{ padding:"7px 0", borderBottom:"1px solid #f0e8ea", textAlign:"right" as const, fontSize:"11px", fontWeight:600, color:"#1a0f12", whiteSpace:"nowrap", verticalAlign:"top", minWidth:"60px" }}>
                      ₹{it.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"6px 0 4px" }} />

            {/* Totals */}
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <tbody>
                {[
                  { label:`Subtotal`, val:`₹${data.subtotal.toLocaleString("en-IN")}` },
                  { label:`CGST @ ${data.halfGst}%`, val:`₹${data.cgst.toFixed(2)}` },
                  { label:`SGST @ ${data.halfGst}%`, val:`₹${data.sgst.toFixed(2)}` },
                ].map(r => (
                  <tr key={r.label}>
                    <td style={{ padding:"3px 0", fontSize:"10px", color:"#555" }}>{r.label}</td>
                    <td style={{ padding:"3px 0", fontSize:"10px", color:"#555", textAlign:"right" as const, fontWeight:600 }}>{r.val}</td>
                  </tr>
                ))}
                {data.discountAmt && data.discountAmt > 0 ? (
                  <tr>
                    <td style={{ padding:"3px 0", fontSize:"10px", color:"#059669", fontWeight:600 }}>Discount{data.discountNote ? ` — ${data.discountNote}` : ""}</td>
                    <td style={{ padding:"3px 0", fontSize:"10px", color:"#059669", fontWeight:600, textAlign:"right" as const }}>− ₹{data.discountAmt.toLocaleString("en-IN")}</td>
                  </tr>
                ) : null}
                <tr>
                  <td style={{ padding:"8px 0 3px", fontSize:"15px", fontWeight:800, color:"#111", borderTop:"1.5px solid #111" }}>Grand Total</td>
                  <td style={{ padding:"8px 0 3px", fontSize:"15px", fontWeight:800, color:"#111", borderTop:"1.5px solid #111", textAlign:"right" as const }}>₹{data.total.toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
            </table>

            {data.notes && (
              <div style={{ marginTop:"8px", padding:"6px 8px", background:"#fafafa", borderRadius:"4px", borderLeft:"2px solid #111" }}>
                <span style={{ fontWeight:700, textTransform:"uppercase" as const, fontSize:"7.5px", color:"#9A7A80", display:"block", marginBottom:"2px" }}>Notes</span>
                <span style={{ fontSize:"9px", color:"#5A3A40", lineHeight:"1.6" }}>{data.notes}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding:"10px 12px", textAlign:"center" as const, borderTop:"1px dashed #ccc" }}>
            <p style={{ fontSize:"10px", fontWeight:800, color:"#111", marginBottom:"4px" }}>Thank you for visiting {data.brandName || "us"}!</p>
            <p style={{ fontSize:"8px", color:"#9A7A80", lineHeight:"1.7" }}>
              Computer-generated invoice. No signature required.<br />
              {data.brandEmail} &nbsp;|&nbsp; {data.brandWebsite}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
