import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/attendance?month=6&year=2026
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now   = new Date();
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59);

  try {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { employeeId: "asc" },
      include: {
        attendance: {
          where: { date: { gte: monthStart, lte: monthEnd } },
          orderBy: { date: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      month,
      year,
      data: staff.map(s => ({
        id:          s.employeeId,
        dbId:        s.id,
        name:        s.name,
        designation: s.designation,
        records:     s.attendance.map(a => ({
          date:       a.date.toISOString().slice(0, 10),
          status:     a.status,
          clockIn:    a.clockIn  ? new Date(a.clockIn).toLocaleTimeString("en-IN",  { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
          clockOut:   a.clockOut ? new Date(a.clockOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
          workHours:  a.workHours ? Number(a.workHours) : null,
          notes:      a.notes,
        })),
      })),
    });
  } catch (e) {
    console.error("[ATTENDANCE GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load attendance." }, { status: 500 });
  }
}

// POST /api/attendance — upsert a day's record
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { staffDbId, date, status, notes, action } = await req.json();
    if (!staffDbId || !date || !status) {
      return NextResponse.json({ success: false, error: "staffDbId, date and status are required." }, { status: 400 });
    }

    const dateObj = new Date(date);
    const now     = new Date();

    let clockIn: Date | undefined | null     = undefined;
    let clockOut: Date | undefined | null    = undefined;
    let workHours: number | undefined | null = undefined;

    if (action === "clock_in") {
      clockIn   = now;
      clockOut  = null;
      workHours = null;
    }

    const updateData = {
      status,
      notes: notes ?? null,
      ...(clockIn   !== undefined && { clockIn }),
      ...(clockOut  !== undefined && { clockOut }),
      ...(workHours !== undefined && { workHours }),
    };

    const record = await prisma.attendance.upsert({
      where:  { staffId_date: { staffId: staffDbId, date: dateObj } },
      create: { staffId: staffDbId, date: dateObj, ...updateData },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        date:      record.date.toISOString().slice(0, 10),
        status:    record.status,
        notes:     record.notes,
        clockIn:   record.clockIn  ? new Date(record.clockIn).toLocaleTimeString("en-IN",  { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
        clockOut:  record.clockOut ? new Date(record.clockOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
        workHours: record.workHours ? Number(record.workHours) : null,
      },
    });
  } catch (e) {
    console.error("[ATTENDANCE POST]", e);
    return NextResponse.json({ success: false, error: "Failed to save attendance." }, { status: 500 });
  }
}
