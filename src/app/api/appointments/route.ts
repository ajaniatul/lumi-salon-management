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
  return {
    id: a.id,
    staffId: a.staffId,
    customer: a.customer?.name ?? "",
    phone: a.customer?.phone ?? "",
    customerCode: a.customer?.customerId ?? null,
    service: svcList.length > 1 ? `${svcList[0].name} +${svcList.length - 1} more` : (svcList[0]?.name ?? "Service"),
    services: svcList,
    invoiceNumber: a.invoice?.invoiceNumber ?? null,
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

  try {
    const appts = await prisma.appointment.findMany({
      where: { startTime: { gte: dayStart, lt: dayEnd } },
      include: {
        customer: { select: { name: true, phone: true, customerId: true } },
        services: { include: { service: { select: { name: true, gstRate: true } } } },
        invoice: { select: { invoiceNumber: true, totalAmount: true } },
      },
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
    const { date, staffId, startSlot, endSlot, serviceIds, customerCode, newCustomer, notes, packagePrice } = body ?? {};

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
        ...(svcs.length > 0 ? { services: { create: svcs.map((sv, i) => ({
          serviceId: sv.id,
          price: packagePrice != null
            ? (i === 0 ? Number(packagePrice) : 0)
            : sv.price,
          duration,
        })) } } : {}),
      },
      include: {
        customer: { select: { name: true, phone: true, customerId: true } },
        services: { include: { service: { select: { name: true, gstRate: true } } } },
      },
    });
    return NextResponse.json({ success: true, data: toUI(created) }, { status: 201 });
  } catch (e: any) {
    console.error("[APPOINTMENTS POST]", e);
    return NextResponse.json({ success: false, error: e?.message ?? "Failed to create appointment" }, { status: 500 });
  }
}
