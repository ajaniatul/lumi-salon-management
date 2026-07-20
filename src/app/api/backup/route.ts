import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Auth ─────────────────────────────────────────────────────────────────────
function getSheets() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth  = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function ensureSheets(sheets: any, titles: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = meta.data.sheets.map((s: any) => s.properties.title);
  const toAdd    = titles.filter(t => !existing.includes(t));
  if (toAdd.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: toAdd.map((title: any) => ({
          addSheet: { properties: { title } },
        })),
      },
    });
  }
}

async function writeTab(sheets: any, tab: string, rows: any[][]) {
  const range = `${tab}!A1`;
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${tab}!A:ZZ` });
  if (rows.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }
}

const fmt = (v: any) => v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 19).replace("T", " ") : String(v);

// ── Main backup ───────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const sheets = getSheets();

    const tabs = ["Customers", "Invoices", "Appointments", "Staff", "Services", "Products", "Expenses", "Attendance", "PettyCash"];
    await ensureSheets(sheets, tabs);

    // ── Customers ─────────────────────────────────────────────────────────────
    const customers = await prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
    await writeTab(sheets, "Customers", [
      ["ID", "Name", "Phone", "Email", "DOB", "Anniversary", "Total Visits", "Total Spent", "Loyalty Points", "Notes", "Created At"],
      ...customers.map((c: any) => [c.id, c.name, c.phone, fmt(c.email), fmt(c.dateOfBirth), fmt(c.anniversary),
        c.totalVisits, fmt(c.totalSpent), c.loyaltyPoints, fmt(c.notes), fmt(c.createdAt)]),
    ]);

    // ── Invoices ──────────────────────────────────────────────────────────────
    const invoices = await prisma.invoice.findMany({
      include: { customer: { select: { name: true, phone: true } }, items: true },
      orderBy: { createdAt: "desc" },
    });
    await writeTab(sheets, "Invoices", [
      ["Invoice No", "Date", "Customer", "Phone", "Items", "Subtotal", "CGST", "SGST", "Total", "Paid", "Due", "Status", "Method"],
      ...invoices.map((inv: any) => [
        inv.invoiceNumber, fmt(inv.createdAt), inv.customer?.name ?? "", inv.customer?.phone ?? "",
        inv.items.map((i: any) => i.name).join(", "),
        fmt(inv.taxableAmount), fmt(inv.cgst), fmt(inv.sgst),
        fmt(inv.totalAmount), fmt(inv.paidAmount), fmt(inv.dueAmount), inv.paymentStatus,
        inv.items.length > 0 ? "" : "",
      ]),
    ]);

    // ── Appointments ──────────────────────────────────────────────────────────
    const appts = await prisma.appointment.findMany({
      include: {
        customer: { select: { name: true, phone: true } },
        staff:    { select: { name: true } },
        services: { include: { service: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
    });
    await writeTab(sheets, "Appointments", [
      ["ID", "Date", "Start Time", "Customer", "Phone", "Staff", "Services", "Duration (min)", "Status", "Notes"],
      ...appts.map((a: any) => [
        a.id, fmt(a.date), a.startTime,
        a.customer?.name ?? "", a.customer?.phone ?? "",
        a.staff?.name ?? "",
        a.services.map((s: any) => s.service?.name ?? s.serviceName).join(", "),
        a.duration, a.status, fmt(a.notes),
      ]),
    ]);

    // ── Staff ─────────────────────────────────────────────────────────────────
    const staff = await prisma.staff.findMany({ orderBy: { name: "asc" } });
    await writeTab(sheets, "Staff", [
      ["ID", "Name", "Phone", "Email", "Role", "Designation", "Commission %", "Salary", "Join Date", "Active"],
      ...staff.map((s: any) => [s.id, s.name, s.phone, fmt(s.email), s.role, fmt(s.designation),
        fmt(s.commissionRate), fmt(s.salary), fmt(s.joinDate), s.isActive]),
    ]);

    // ── Services ─────────────────────────────────────────────────────────────
    const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
    await writeTab(sheets, "Services", [
      ["Code", "Name", "Category", "Price", "Duration (min)", "GST %", "Description"],
      ...services.map((s: any) => [s.serviceCode, s.name, s.category, fmt(s.price), s.duration, fmt(s.gstRate), fmt(s.description)]),
    ]);

    // ── Products ─────────────────────────────────────────────────────────────
    const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
    await writeTab(sheets, "Products", [
      ["ID", "Name", "Brand", "Category", "Price", "Cost", "Stock", "Min Stock", "HSN Code"],
      ...products.map((p: any) => [p.id, p.name, fmt(p.brand), p.category, fmt(p.price), fmt(p.costPrice), p.stockQuantity, p.minStockLevel, fmt(p.hsnCode)]),
    ]);

    // ── Expenses ─────────────────────────────────────────────────────────────
    const expenses = await prisma.expense.findMany({ orderBy: { date: "desc" } });
    await writeTab(sheets, "Expenses", [
      ["ID", "Date", "Category", "Description", "Amount", "Paid To", "Payment Method", "Notes"],
      ...expenses.map((e: any) => [e.id, fmt(e.date), e.category, e.description, fmt(e.amount), fmt(e.paidTo), fmt(e.paymentMethod), fmt(e.notes)]),
    ]);

    // ── Attendance ────────────────────────────────────────────────────────────
    const attendance = await prisma.attendance.findMany({
      include: { staff: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    await writeTab(sheets, "Attendance", [
      ["Date", "Staff", "Status", "Clock In", "Clock Out", "Notes"],
      ...attendance.map((a: any) => [fmt(a.date), a.staff?.name ?? "", a.status, fmt(a.clockIn), fmt(a.clockOut), fmt(a.notes)]),
    ]);

    // ── Petty Cash ────────────────────────────────────────────────────────────
    const petty = await prisma.pettyCashTransaction.findMany({ orderBy: { date: "desc" } });
    await writeTab(sheets, "PettyCash", [
      ["ID", "Date", "Type", "Category", "Description", "Amount", "Running Balance"],
      ...petty.map((p: any) => [p.id, fmt(p.date), p.type, p.category, p.description, fmt(p.amount), fmt(p.balance)]),
    ]);

    const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
    return NextResponse.json({ success: true, message: `Backup complete at ${ts}` });
  } catch (e: any) {
    console.error("[BACKUP]", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
