import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// GET /api/staff — active staff by default; ?all=true returns everyone
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const showAll = request.nextUrl.searchParams.get("all") === "true";
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const staff = await prisma.staff.findMany({
      where: showAll ? {} : { isActive: true },
      orderBy: { employeeId: "asc" },
      include: {
        commissionSettings: { where: { isActive: true }, take: 1 },
        appointments: {
          where: { startTime: { gte: monthStart } },
          include: { services: { select: { price: true } } },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: staff.map(s => {
        const monthCompleted = s.appointments.filter(a => a.status === "COMPLETED");
        const monthRevenue   = monthCompleted.reduce((sum, a) =>
          sum + a.services.reduce((s2, si) => s2 + Number(si.price), 0), 0);

        return {
          id:              s.employeeId,
          dbId:            s.id,
          name:            s.name,
          initials:        s.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase(),
          designation:     s.designation,
          phone:           s.phone,
          email:           s.email ?? "",
          isActive:        s.isActive,
          specializations: s.specializations,
          commissionRate:  s.commissionSettings[0] ? Number(s.commissionSettings[0].rate) : 0,
          thisMonth: {
            appointments: s.appointments.length,
            completed:    monthCompleted.length,
            revenue:      monthRevenue,
          },
        };
      }),
    });
  } catch (e) {
    console.error("[STAFF GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load staff" }, { status: 500 });
  }
}

// POST /api/staff — create new staff member
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { name, designation, phone, email, salary, bio, specialization, commissionRate } = body ?? {};

    if (!name?.trim() || !phone?.trim() || !designation?.trim()) {
      return NextResponse.json({ success: false, error: "Name, designation and phone are required." }, { status: 400 });
    }

    // Generate employee ID
    const count = await prisma.staff.count();
    const employeeId = `EMP-${String(count + 1).padStart(3, "0")}`;

    // Create a user account for the staff member
    const defaultPassword = `lumi${employeeId.toLowerCase()}`;
    const passwordHash    = await bcrypt.hash(defaultPassword, 10);
    const user = await prisma.user.create({
      data: {
        email:        email?.trim() || `${employeeId.toLowerCase()}@lumi.in`,
        name:         name.trim(),
        role:         "STYLIST",
        passwordHash,
      },
    });

    const staff = await prisma.staff.create({
      data: {
        employeeId,
        userId:          user.id,
        name:            name.trim(),
        phone:           phone.trim(),
        email:           email?.trim() || null,
        designation:     designation.trim(),
        specializations: specialization ? specialization.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        salary:          Number(salary) || 0,
        bio:             bio?.trim() || null,
        joiningDate:     new Date(),
      },
    });

    // Create commission setting if rate > 0
    if (Number(commissionRate) > 0) {
      await prisma.commissionSetting.create({
        data: {
          staffId:  staff.id,
          type:     "SERVICE_BASED",
          rate:     Number(commissionRate),
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { id: staff.employeeId, dbId: staff.id, name: staff.name },
    });
  } catch (e: any) {
    console.error("[STAFF POST]", e);
    if (e.code === "P2002") {
      return NextResponse.json({ success: false, error: "A staff member with this phone or email already exists." }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: "Failed to create staff member." }, { status: 500 });
  }
}
