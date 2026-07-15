"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InvoiceData, generateInvoiceHTML } from "@/components/InvoiceA4";
import { Printer, Loader2 } from "lucide-react";

export default function PublicInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [data,    setData]    = useState<InvoiceData | null>(null);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/invoices/view?num=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setData(j.data);
        else setError(j.error || "Invoice not found");
      })
      .catch(() => setError("Could not load invoice"))
      .finally(() => setLoading(false));
  }, [id]);

  const openPrint = () => {
    if (!data) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(generateInvoiceHTML(data));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"12px" }}>
      <Loader2 style={{ width:28, height:28, color:"#888", animation:"spin 1s linear infinite" }} />
      <p style={{ color:"#888", fontSize:"13px" }}>Loading invoice…</p>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:"#ef4444", fontSize:"14px" }}>{error || "Invoice not found"}</p>
    </div>
  );

  const sColor = data.status==="PAID" ? "#059669" : data.status==="PARTIAL" ? "#2563EB" : data.status==="INFLUENCER" ? "#7C3AED" : "#DC2626";
  const sBg    = data.status==="PAID" ? "#D1FAE5"  : data.status==="PARTIAL" ? "#DBEAFE"  : data.status==="INFLUENCER" ? "#EDE9FE" : "#FEE2E2";
  const sLabel = data.status==="PAID" ? "PAID" : data.status==="PARTIAL" ? "PARTIAL" : data.status==="INFLUENCER" ? "INFLUENCER" : "PENDING";
  const discountAmt = data.discountAmt ?? 0;

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", flexDirection:"column" }}>
      {/* Toolbar */}
      <div style={{ background:"rgba(20,20,20,0.97)", borderBottom:"1px solid #333", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ background:"#222", padding:"6px 14px", borderRadius:"8px", border:"1px solid #333" }}>
            <span style={{ color:"#fff", fontSize:"11px", fontWeight:700, letterSpacing:"0.12em" }}>{data.brandName || "LUMI"}</span>
          </div>
          <div>
            <p style={{ color:"white", fontSize:"13px", fontWeight:600 }}>{data.invoiceNo}</p>
            <p style={{ color:"#888", fontSize:"11px" }}>{data.customer} · {data.date}</p>
          </div>
        </div>
        <button onClick={openPrint}
          style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 18px", borderRadius:"10px", background:"#111", border:"1px solid #333", color:"white", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
          <Printer style={{ width:"14px", height:"14px" }} />
          Print / Save PDF
        </button>
      </div>

      {/* A4 Paper */}
      <div style={{ flex:1, overflowY:"auto", padding:"40px 16px", display:"flex", justifyContent:"center" }}>
        <div style={{ width:"210mm", minHeight:"297mm", background:"white", boxShadow:"0 32px 100px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column" }}>

          {/* Header */}
          <div style={{ background:"linear-gradient(135deg,#0a0a0a 0%,#333 55%,#555 100%)", padding:"36px 44px 30px" }}>
            {data.brandLogo ? (
              <img src={data.brandLogo} style={{ height:"150px", maxWidth:"350px", objectFit:"contain", position:"relative", left:"-48px", marginBottom:"-25px" }} alt="Logo" />
            ) : (
              <div style={{ marginBottom:"10px" }}>
                <p style={{ color:"white", fontSize:"26px", fontWeight:900, letterSpacing:"0.1em", marginBottom:"4px" }}>{data.brandName || "LUMI"}</p>
                <p style={{ color:"rgba(255,255,255,0.65)", fontSize:"10px", letterSpacing:"0.28em", textTransform:"uppercase", marginBottom:"0" }}>{data.brandTagline || "Where Beauty Meets Luxury"}</p>
              </div>
            )}
            <p style={{ color:"rgba(255,255,255,0.5)", fontSize:"9.5px", lineHeight:1.7 }}>
              GSTIN: {data.brandGstin || "—"} &nbsp;·&nbsp; {data.brandAddress || "—"}<br />
              Tel: {data.brandPhone || "—"} / 9995818169 &nbsp;·&nbsp; {data.brandEmail || "—"}
            </p>
          </div>

          {/* Meta bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 44px", background:"#fafafa", borderBottom:"1px solid #e5e5e5" }}>
            {[{ lbl:"Invoice No.", val:data.invoiceNo }, { lbl:"Date", val:data.date }].map(m => (
              <div key={m.lbl}>
                <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.18em", color:"#888", marginBottom:"3px" }}>{m.lbl}</p>
                <p style={{ fontSize:"14px", fontWeight:700, color:"#111" }}>{m.val}</p>
              </div>
            ))}
            <div>
              <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.18em", color:"#888", marginBottom:"3px" }}>Status</p>
              <span style={{ display:"inline-block", padding:"4px 14px", borderRadius:"999px", fontSize:"10px", fontWeight:700, color:sColor, background:sBg }}>{sLabel}</span>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding:"30px 44px", flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"26px", paddingBottom:"22px", borderBottom:"1px solid #e5e5e5" }}>
              <div>
                <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.15em", color:"#888", marginBottom:"5px" }}>Bill To</p>
                <p style={{ fontSize:"15px", fontWeight:700, color:"#111", marginBottom:"2px" }}>{data.customer}</p>
                {data.phone && <p style={{ fontSize:"11px", color:"#6B7280" }}>{data.phone}</p>}
              </div>
              {data.stylist && (
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:"7.5px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.15em", color:"#888", marginBottom:"5px" }}>Attended By</p>
                  <p style={{ fontSize:"15px", fontWeight:700, color:"#111", marginBottom:"2px" }}>{data.stylist}</p>
                  {data.stylistRole && <p style={{ fontSize:"11px", color:"#6B7280" }}>{data.stylistRole}</p>}
                </div>
              )}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", paddingBottom:"8px", borderTop:"1px solid #e5e5e5", borderBottom:"2px solid #e5e5e5", marginBottom:"4px" }}>
              {["Description","Amount"].map(h => (
                <span key={h} style={{ fontSize:"8px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.15em", color:"#888" }}>{h}</span>
              ))}
            </div>

            {data.items.map((it, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"10px 0", borderBottom:"1px solid #f0f0f0" }}>
                <div>
                  <p style={{ fontSize:"13px", fontWeight:600, color:"#111" }}>{it.description}</p>
                  <p style={{ fontSize:"10px", color:"#999", marginTop:"1px" }}>{it.type}</p>
                </div>
                <p style={{ fontSize:"13px", fontWeight:600, color:"#111", whiteSpace:"nowrap" }}>Rs.{it.amount.toLocaleString("en-IN")}</p>
              </div>
            ))}

            <div style={{ borderTop:"1px solid #e5e5e5", marginTop:"4px" }}>
              {[
                { label:"Subtotal", value:`Rs.${data.subtotal.toLocaleString("en-IN")}`, color:"#6B7280" },
                ...(discountAmt > 0 ? [{ label:`Discount${data.discountNote ? ` — ${data.discountNote}` : ""}`, value:`− Rs.${discountAmt.toLocaleString("en-IN")}`, color:"#059669" }] : []),
                { label:`CGST @ ${data.halfGst}%`, value:`Rs.${data.cgst.toLocaleString("en-IN")}`, color:"#6B7280" },
                { label:`SGST @ ${data.halfGst}%`, value:`Rs.${data.sgst.toLocaleString("en-IN")}`, color:"#6B7280" },
              ].map((r, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0" }}>
                  <span style={{ fontSize:"12px", color:r.color }}>{r.label}</span>
                  <span style={{ fontSize:"12px", fontWeight:600, color:r.color }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", borderTop:"2.5px solid #111", marginTop:"4px" }}>
                <span style={{ fontSize:"17px", fontWeight:800, color:"#111" }}>Grand Total</span>
                <span style={{ fontSize:"17px", fontWeight:800, color:"#111" }}>Rs.{data.total.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"20px", padding:"12px 18px", background:"#D1FAE5", border:"1px solid #A7F3D0", borderRadius:"10px" }}>
              <span style={{ fontSize:"12px", fontWeight:700, color:"#065F46" }}>Payment via {data.payMethod}</span>
              <span style={{ fontSize:"12px", fontWeight:700, color:"#065F46" }}>Rs.{data.total.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background:"#fafafa", borderTop:"1px solid #e5e5e5", padding:"18px 44px", textAlign:"center" }}>
            <p style={{ fontSize:"13px", fontWeight:800, color:"#111", marginBottom:"6px" }}>Thank you for visiting {data.brandName || "Lumi"}!</p>
            <p style={{ fontSize:"9.5px", color:"#888", lineHeight:1.7 }}>
              This is a computer-generated invoice and does not require a signature.<br />
              For queries, reach us at {data.brandPhone || "—"} / 9995818169 or {data.brandEmail || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
