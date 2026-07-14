import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SLOT_MINS = 5;
const DAY_START = 10;

function timeToSlot(d: Date) {
  return (d.getHours() - DAY_START) * (60 / SLOT_MINS) + Math.round(d.getMinutes() / SLOT_MINS);
}
function slotToTime(slot: number) {
  const total = DAY_START * 60 + slot * SLOT_MINS;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// GET /api/customers/[id] — full customer profile
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ customerId: params.id }, { id: params.id }],
        isActive: true,
      },
      include: {
        membership: {
          include: { membership: true },
        },
        appointments: {
          orderBy: { startTime: "desc" },
          take: 30,
          include: {
            staff: { select: { name: true, designation: true } },
            services: { include: { service: { select: { name: true } } } },
            invoice: { select: { invoiceNumber: true } },
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            items: { include: { product: { select: { hsnCode: true } } } },
            payments: { select: { method: true, amount: true, notes: true } },
          },
        },
        packages: {
          include: {
            package: { include: { services: true } },
            sessionUsages: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
    }

    // Parse notes JSON for allergies/preferences/general
    let notesData: { allergies?: string; preferences?: string; general?: string } = {};
    try { notesData = customer.notes ? JSON.parse(customer.notes) : {}; } catch {
      notesData = { general: customer.notes ?? "" };
    }

    const tier = customer.membership?.membership?.tier;
    const tierLabel = tier ? (tier.charAt(0) + tier.slice(1).toLowerCase()) : null;

    const appts = customer.appointments.map(a => {
      const startSlot = timeToSlot(new Date(a.startTime));
      const endSlot   = timeToSlot(new Date(a.endTime));
      const serviceName = a.services[0]?.service?.name ?? "Service";
      const durationMins = a.duration;
      return {
        id:        a.id,
        date:      new Date(a.startTime).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
        service:   serviceName,
        stylist:   a.staff.name,
        duration:  `${durationMins} min`,
        amount:    Number(a.services[0]?.price ?? 0),
        status:    a.status,
        time:      slotToTime(startSlot),
        invoiceId: a.invoice?.invoiceNumber ?? "—",
      };
    });

    const invoices = customer.invoices.map(inv => {
      let meta: any = {};
      try { meta = JSON.parse(inv.notes || "{}"); } catch {}
      const isInfluencer = meta.isInfluencer === true;
      const methodLabel  = meta.methodLabel ?? (inv.payments?.[0]?.notes ?? inv.payments?.[0]?.method ?? "-");
      return {
        id:          inv.invoiceNumber,
        dbId:        inv.id,
        date:        new Date(inv.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
        subtotal:    Number(inv.taxableAmount),
        cgst:        Number(inv.cgst),
        sgst:        Number(inv.sgst),
        total:       Number(inv.totalAmount),
        paid:        Number(inv.paidAmount),
        due:         Number(inv.dueAmount),
        method:      methodLabel,
        status:      isInfluencer ? "INFLUENCER" : inv.paymentStatus,
        items:       inv.items.map(it => ({
          name:   it.name,
          type:   it.itemType === "SERVICE" ? "Service" : "Product",
          code:   it.itemType === "SERVICE" ? "999721" : (it.product?.hsnCode ?? "3305"),
          amount: Number(it.total),
        })),
        discount:    meta.discountNote ?? "",
        discountAmt: Number(inv.discountAmount),
      };
    });

    const packages = customer.packages.map(cp => ({
      name:    cp.package.name,
      total:   cp.package.services.reduce((sum, s) => sum + s.sessions, 0) || 1,
      used:    cp.sessionUsages.length,
      expiry:  new Date(cp.expiryDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
      price:   Number(cp.package.price),
      status:  cp.isActive && new Date(cp.expiryDate) > new Date() ? "ACTIVE" : "EXPIRED",
    }));

    return NextResponse.json({
      success: true,
      data: {
        id:               customer.customerId,
        dbId:             customer.id,
        name:             customer.name,
        initials:         customer.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase(),
        phone:            customer.phone ?? "",
        email:            customer.email ?? "",
        gender:           customer.gender ?? "",
        dob:              customer.dateOfBirth
          ? new Date(customer.dateOfBirth).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
          : "",
        anniversary:      customer.anniversary
          ? new Date(customer.anniversary).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
          : null,
        memberSince:      new Date(customer.createdAt).toLocaleDateString("en-IN", { month:"short", year:"numeric" }),
        visits:           customer.totalVisits,
        totalSpent:       Number(customer.totalSpend),
        lastVisit:        appts.find(a => a.status === "COMPLETED")?.date ?? "Never",
        membership:       tierLabel,
        membershipExpiry: customer.membership?.expiryDate
          ? new Date(customer.membership.expiryDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
          : null,
        membershipDiscount: Number(customer.membership?.membership?.discountPercent ?? 0),
        preferredStaff:   null,
        tags:             customer.tags ?? [],
        notes:            notesData,
        appts,
        invoices,
        packages,
      },
    });
  } catch (e) {
    console.error("[CUSTOMER GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load customer." }, { status: 500 });
  }
}

// PATCH /api/customers/[id] — update notes
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();

    // Toggle active status
    if (typeof body.isActive === "boolean") {
      const updated = await prisma.customer.updateMany({
        where: { OR: [{ customerId: params.id }, { id: params.id }] },
        data:  { isActive: body.isActive },
      });
      if (updated.count === 0) return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      return NextResponse.json({ success: true, data: { isActive: body.isActive } });
    }

    // Update profile fields
    if (body._profileUpdate) {
      const { name, phone, email, gender, dob, anniversary, tags } = body;
      if (!name?.trim() || !phone?.trim()) {
        return NextResponse.json({ success: false, error: "Name and phone are required." }, { status: 400 });
      }
      const updateData: any = {
        name:        name.trim(),
        phone:       phone.trim(),
        email:       email?.trim() || null,
        gender:      gender || null,
        tags:        Array.isArray(tags) ? tags : [],
        dateOfBirth: dob ? new Date(dob) : null,
        anniversary: anniversary ? new Date(anniversary) : null,
      };
      try {
        await prisma.customer.updateMany({
          where: { OR: [{ customerId: params.id }, { id: params.id }] },
          data:  updateData,
        });
      } catch (e: any) {
        if (e?.code === "P2002") {
          return NextResponse.json({ success: false, error: "That phone number is already used by another customer." }, { status: 409 });
        }
        throw e;
      }
      return NextResponse.json({ success: true });
    }

    // Update notes
    const { allergies, preferences, general } = body ?? {};
    const notesJson = JSON.stringify({ allergies: allergies ?? "", preferences: preferences ?? "", general: general ?? "" });

    const updated = await prisma.customer.updateMany({
      where: { OR: [{ customerId: params.id }, { id: params.id }] },
      data:  { notes: notesJson },
    });

    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[CUSTOMER PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update customer." }, { status: 500 });
  }
}
