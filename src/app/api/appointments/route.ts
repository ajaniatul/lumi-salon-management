import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DAY_START = 10;   // scheduler starts at 10:00
const SLOT_MINS = 5;

// slot (5-min units from 10:00) → {h, m}
function slotToHM(slot: number) {
  const total = DAY_START * 60 + slot * SLOT_MINS;
  return { h: Math.floor(total / 60), m: total % 60 };
}
// local DateTime → slot
function timeToSlot(d: Date) {
  return (d.getHours() - DAY_START) * (60 / SLOT_MINS) + Math.round(d.getMinutes() / SLOT_MINS);
}

function toUI(a: any) {
  const svcRows = a.services ?? [];
  const svcList = svcRows.map((sv: any) => ({
    id: sv.serviceId,
    name: sv.service?.name ?? "Service",
    price: Number(sv.price),
    gstRate: sv.service?.gstRate != null ? Number(sv.service.gstRate) : 18,
  }));
  // For appointments billed as secondary in a combined invoice, billedWith is in notes JSON
  let parsedNotes: any = {};
  try { parsedNotes = JSON.parse(a.notes || "{}"); } catch {}
  const billedWith = parsedNotes.billedWith ?? null;
  return {
    id: a.id,
    staffId: a.staffId,
    staffName: a.staff?.name ?? null,
    customer: a.customer?.name ?? "",
    phone: a.customer?.phone ?? "",
    customerCode: a.customer?.customerId ?? null,
    service: svcList.length > 1 ? `${svcList[0].name} +${svcList.length - 1} more` : (svcList[0]?.name ?? "Service"),
    services: svcList,
    invoiceNumber: a.invoice?.invoiceNumber ?? billedWith ?? null,
    invoiceTotal: a.invoice?.totalAmount != null ? Number(a.invoice.totalAmount) : null,
    startSlot: timeToSlot(new Date(a.startTime)),
    durationSlots: Math.max(1, Math.round(a.duration / SLOT_MINS)),
    status: a.status,
    notes: a.notes ?? undefined,
  };
}

// GET /api/appointments?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const dateStr = request.nextUrl.searchParams.get("date");
  if (!dateStr) return NextResponse.json({ success: false, error: "date is required" }, { status: 400 });

  const [y, mo, d] = dateStr.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, mo - 1, d + 1, 0, 0, 0, 0);

  const mode         = request.nextUrl.searchParams.get("mode");
  const customerCode = request.nextUrl.searchParams.get("customerCode");
  const excludeId    = request.nextUrl.searchParams.get("excludeId");

  const INCLUDE = {
    customer: { select: { name: true, phone: true, customerId: true } },
    staff:    { select: { name: true, designation: true } },
    services: { include: { service: { select: { name: true, gstRate: true } } } },
    invoice:  { select: { invoiceNumber: true, totalAmount: true } },
  };

  try {
    // ── Siblings mode: same-day same-customer, not yet billed ─────────────
    if (mode === "siblings" && customerCode) {
      const customer = await prisma.customer.findUnique({
        where: { customerId: customerCode },
        select: { id: true },
      });
      if (!customer) return NextResponse.json({ success: true, data: [] });

      const all = await prisma.appointment.findMany({
        where: {
          startTime: { gte: dayStart, lt: dayEnd },
          customerId: customer.id,
          id: excludeId ? { not: excludeId } : undefined,
          status: { in: ["CONFIRMED", "WAITING", "IN_PROGRESS"] },
          invoice: null, // not already invoiced via appointmentId link
        },
        include: INCLUDE,
        orderBy: { startTime: "asc" },
      });
      // Also exclude appointments whose notes contain billedWith (secondary billed)
      const unbilled = all.filter(a => {
        try { return !JSON.parse(a.notes || "{}").billedWith; } catch { return true; }
      });
      return NextResponse.json({ success: true, data: unbilled.map(toUI) });
    }

    // ── Normal mode: all appointments on date ─────────────────────────────
    const appts = await prisma.appointment.findMany({
      where: { startTime: { gte: dayStart, lt: dayEnd } },
      include: INCLUDE,
      orderBy: { startTime: "asc" },
    });
    return NextResponse.json({ success: true, data: appts.map(toUI) });
  } catch (e) {
    console.error("[APPOINTMENTS GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load appointments" }, { status: 500 });
  }
}

// POST /api/appointments — create a booking
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { date, staffId, startSlot, endSlot, serviceIds, customerCode, newCustomer, notes, packagePrice, packageServiceIds } = body ?? {};

    if (!date || !staffId || startSlot == null || endSlot == null || endSlot <= startSlot) {
      return NextResponse.json({ success: false, error: "Missing or invalid booking details." }, { status: 400 });
    }

    // ── Resolve / create customer ──
    let customerId: string;
    if (customerCode) {
      const c = await prisma.customer.findUnique({ where: { customerId: customerCode }, select: { id: true } });
      if (!c) return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      customerId = c.id;
    } else if (newCustomer?.name?.trim() && newCustomer?.phone?.trim()) {
      const existing = await prisma.customer.findUnique({ where: { phone: newCustomer.phone.trim() }, select: { id: true } });
      if (existing) {
        customerId = existing.id;
      } else {
        const last = await prisma.customer.findFirst({ orderBy: { customerId: "desc" }, select: { customerId: true } });
        const nextNum = last ? parseInt(last.customerId.replace(/\D/g, ""), 10) + 1 : 1;
        const created = await prisma.customer.create({
          data: {
            customerId: `CUS-${String(nextNum).padStart(4, "0")}`,
            name: newCustomer.name.trim(),
            phone: newCustomer.phone.trim(),
            email: newCustomer.email?.trim() || null,
            tags: ["New"],
          },
          select: { id: true },
        });
        customerId = created.id;
      }
    } else {
      return NextResponse.json({ success: false, error: "A customer is required." }, { status: 400 });
    }

    // ── Resolve services (optional) ──
    const uniqueServiceIds = Array.isArray(serviceIds) ? [...new Set(serviceIds)] as string[] : [];
    const svcs = uniqueServiceIds.length > 0
      ? await prisma.service.findMany({ where: { id: { in: uniqueServiceIds } }, select: { id: true, price: true } })
      : [];
    if (uniqueServiceIds.length > 0 && svcs.length !== uniqueServiceIds.length) {
      return NextResponse.json({ success: false, error: "One or more services not found." }, { status: 404 });
    }

    // ── Times ──
    const [y, mo, d] = String(date).split("-").map(Number);
    const s = slotToHM(startSlot), e = slotToHM(endSlot);
    const startTime = new Date(y, mo - 1, d, s.h, s.m, 0, 0);
    const endTime = new Date(y, mo - 1, d, e.h, e.m, 0, 0);
    const duration = (endSlot - startSlot) * SLOT_MINS;
    const dateOnly = new Date(y, mo - 1, d, 0, 0, 0, 0);

    // ── Appointment number ──
    const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
    const dayEnd = new Date(y, mo - 1, d + 1, 0, 0, 0, 0);
    const ymd = `${y}${String(mo).padStart(2, "0")}${String(d).padStart(2, "0")}`;
    // Use MAX existing number for the day so deletions don't cause reuse collisions
    const lastToday = await prisma.appointment.findFirst({
      where: { appointmentNo: { startsWith: `APT-${ymd}-` } },
      orderBy: { appointmentNo: "desc" },
      select: { appointmentNo: true },
    });
    const lastSeq = lastToday ? parseInt(lastToday.appointmentNo.split("-").pop() ?? "0", 10) : 0;
    const appointmentNo = `APT-${ymd}-${String(lastSeq + 1).padStart(3, "0")}`;

    const created = await prisma.appointment.create({
      data: {
        appointmentNo,
        customerId,
        staffId,
        date: dateOnly,
        startTime,
        endTime,
        duration,
        status: "CONFIRMED",
        notes: notes?.trim() || null,
        source: "WALK_IN",
      },
      include: {
        customer: { select: { name: true, phone: true, customerId: true } },
        services: { include: { service: { select: { name: true, gstRate: true } } } },
      },
    });

    // Attach services if provided, then re-fetch so the include has them
    if (svcs.length > 0) {
      // If packageServiceIds supplied, only those get package pricing; extras keep real price
      const pkgSvcSet = new Set<string>(Array.isArray(packageServiceIds) ? packageServiceIds : []);
      let pkgPriceAssigned = false;
      await prisma.appointmentService.createMany({
        data: svcs.map((sv) => {
          let price: number;
          if (packagePrice != null && pkgSvcSet.size > 0) {
            if (pkgSvcSet.has(sv.id)) {
              price = pkgPriceAssigned ? 0 : Number(packagePrice);
              pkgPriceAssigned = true;
            } else {
              price = Number(sv.price); // individual add-on — keep real price
            }
          } else if (packagePrice != null) {
            // legacy fallback (no packageServiceIds): first = packagePrice, rest = 0
            price = pkgPriceAssigned ? 0 : Number(packagePrice);
            pkgPriceAssigned = true;
          } else {
            price = Number(sv.price);
          }
          return { appointmentId: created.id, serviceId: sv.id, price, duration };
        }),
      });
      const withSvcs = await prisma.appointment.findUnique({
        where: { id: created.id },
        include: {
          customer: { select: { name: true, phone: true, customerId: true } },
          services: { include: { service: { select: { name: true, gstRate: true } } } },
          invoice:  { select: { invoiceNumber: true, totalAmount: true } },
        },
      });
      return NextResponse.json({ success: true, data: toUI(withSvcs) }, { status: 201 });
    }
    return NextResponse.json({ success: true, data: toUI(created) }, { status: 201 });
  } catch (e: any) {
    console.error("[APPOINTMENTS POST]", e);
    return NextResponse.json({ success: false, error: e?.message ?? "Failed to create appointment" }, { status: 500 });
  }
}
