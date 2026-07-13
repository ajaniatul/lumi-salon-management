import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/staff/[id] — full staff profile
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const staff = await prisma.staff.findFirst({
      where: { OR: [{ employeeId: params.id }, { id: params.id }], isActive: true },
      include: {
        commissionSettings: {
          where: { isActive: true },
          include: { service: { select: { name: true } } },
        },
        commissions: {
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 6,
        },
        appointments: {
          where: {
            startTime: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          include: {
            customer: { select: { name: true, customerId: true } },
            services: {
              include: { service: { select: { name: true } } },
            },
          },
          orderBy: { startTime: "desc" },
          take: 50,
        },
        attendance: {
          orderBy: { date: "desc" },
          take: 30,
        },
      },
    });

    if (!staff) {
      return NextResponse.json({ success: false, error: "Staff not found." }, { status: 404 });
    }

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear  = now.getFullYear();

    const monthAppts   = staff.appointments.filter(a => a.status === "COMPLETED");
    const totalRevenue = monthAppts.reduce((sum, a) =>
      sum + a.services.reduce((s2, si) => s2 + Number(si.price), 0), 0);
    const uniqueClients = new Set(monthAppts.map(a => a.customerId)).size;

    const currentComm  = staff.commissions.find(c => c.month === thisMonth + 1 && c.year === thisYear);
    const lastComm     = staff.commissions.find(c =>
      (c.month === thisMonth && c.year === thisYear) ||
      (thisMonth === 0 && c.month === 12 && c.year === thisYear - 1)
    );

    const appts = staff.appointments.map(a => {
      const svcRevenue = a.services.reduce((sum, si) => sum + Number(si.price), 0);
      return {
        id:       a.id,
        date:     new Date(a.startTime).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
        time:     new Date(a.startTime).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }),
        customer: a.customer.name,
        customerId: a.customer.customerId,
        service:  a.services[0]?.service?.name ?? "—",
        services: a.services.length,
        revenue:  svcRevenue,
        status:   a.status,
        duration: a.duration,
      };
    });

    const attendance = staff.attendance.map(att => ({
      date:        new Date(att.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
      checkIn:     att.clockIn  ? new Date(att.clockIn).toLocaleTimeString("en-IN",  { hour:"2-digit", minute:"2-digit" }) : null,
      checkOut:    att.clockOut ? new Date(att.clockOut).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }) : null,
      status:      att.status,
      hoursWorked: att.workHours ? Number(att.workHours).toFixed(1) : null,
    }));

    const defaultCommRate = staff.commissionSettings[0]?.rate
      ? Number(staff.commissionSettings[0].rate)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        id:              staff.employeeId,
        dbId:            staff.id,
        name:            staff.name,
        initials:        staff.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase(),
        phone:           staff.phone,
        email:           staff.email ?? "",
        designation:     staff.designation,
        specializations: staff.specializations,
        salary:          Number(staff.salary),
        bio:             staff.bio ?? "",
        rating:          staff.rating ? Number(staff.rating) : null,
        joined:          new Date(staff.joiningDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
        isActive:        staff.isActive,
        commissionRate:  defaultCommRate,
        commissionSettings: staff.commissionSettings.map(cs => ({
          type:    cs.type,
          rate:    Number(cs.rate),
          service: cs.service?.name ?? null,
        })),
        thisMonth: {
          appointments: staff.appointments.length,
          completed:    monthAppts.length,
          revenue:      totalRevenue,
          clients:      uniqueClients,
          commission:   currentComm ? Number(currentComm.commissionAmount) : Math.round(totalRevenue * (defaultCommRate / 100)),
          bonus:        currentComm ? Number(currentComm.bonusAmount) : 0,
        },
        lastMonth: lastComm ? {
          commission: Number(lastComm.commissionAmount),
          paid:       lastComm.isPaid,
        } : null,
        commissionHistory: staff.commissions.map(c => ({
          month:      `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][c.month - 1]} ${c.year}`,
          amount:     Number(c.commissionAmount),
          bonus:      Number(c.bonusAmount),
          total:      Number(c.totalAmount),
          paid:       c.isPaid,
          svcRevenue: Number(c.serviceRevenue),
          prdRevenue: Number(c.productRevenue),
        })),
        appts,
        attendance,
      },
    });
  } catch (e) {
    console.error("[STAFF GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load staff." }, { status: 500 });
  }
}

// PATCH /api/staff/[id] — update rating or toggle isActive
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const staff = await prisma.staff.findFirst({ where: { OR: [{ employeeId: params.id }, { id: params.id }] } });
    if (!staff) return NextResponse.json({ success: false, error: "Staff not found." }, { status: 404 });

    // Toggle active status
    if (typeof body.isActive === "boolean") {
      const updated = await prisma.staff.update({ where: { id: staff.id }, data: { isActive: body.isActive } });
      return NextResponse.json({ success: true, data: { isActive: updated.isActive } });
    }

    // Update rating
    if (body.rating !== undefined) {
      const num = Number(body.rating);
      if (Number.isNaN(num) || num < 0 || num > 5) {
        return NextResponse.json({ success: false, error: "Rating must be between 0 and 5." }, { status: 400 });
      }
      const updated = await prisma.staff.update({ where: { id: staff.id }, data: { rating: num } });
      return NextResponse.json({ success: true, data: { rating: Number(updated.rating) } });
    }

    return NextResponse.json({ success: false, error: "Nothing to update." }, { status: 400 });
  } catch (e) {
    console.error("[STAFF PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update staff." }, { status: 500 });
  }
}
