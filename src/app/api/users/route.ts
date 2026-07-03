import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Validation schema for creating a user
const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "MANAGER", "RECEPTIONIST", "STYLIST"]),
});

// Validation schema for updating a user (active toggle)
const updateUserSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
});

// GET: List all users (Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("[GET_USERS]", error);
    return NextResponse.json({ success: false, error: "Failed to retrieve users" }, { status: 500 });
  }
}

// POST: Create a new user (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "A user with this email address already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "CREATE",
        entity: "User",
        entityId: newUser.id,
        ipAddress: request.headers.get("x-forwarded-for") ?? request.ip ?? "unknown",
        userAgent: request.headers.get("user-agent") ?? "unknown",
      },
    });

    return NextResponse.json({ success: true, data: newUser });
  } catch (error) {
    console.error("[POST_USER]", error);
    return NextResponse.json({ success: false, error: "Failed to create user account" }, { status: 500 });
  }
}

// PUT: Update user login access status (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    const { id, isActive } = parsed.data;

    // Prevent admin from deactivating their own account
    if (id === session.userId && !isActive) {
      return NextResponse.json({ success: false, error: "You cannot deactivate your own admin profile." }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE",
        entity: "User",
        entityId: id,
        ipAddress: request.headers.get("x-forwarded-for") ?? request.ip ?? "unknown",
        userAgent: request.headers.get("user-agent") ?? "unknown",
      },
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("[PUT_USER]", error);
    return NextResponse.json({ success: false, error: "Failed to update user status" }, { status: 500 });
  }
}

// DELETE: Remove a user account (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
    }

    // Prevent admin from deleting their own account
    if (id === session.userId) {
      return NextResponse.json({ success: false, error: "You cannot delete your own admin profile." }, { status: 400 });
    }

    try {
      // Attempt hard deletion
      await prisma.user.delete({
        where: { id },
      });

      // Create Audit Log
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: "DELETE",
          entity: "User",
          entityId: id,
          ipAddress: request.headers.get("x-forwarded-for") ?? request.ip ?? "unknown",
          userAgent: request.headers.get("user-agent") ?? "unknown",
        },
      });

      return NextResponse.json({ success: true, message: "User deleted successfully" });
    } catch (dbError: any) {
      // Fallback: If foreign key constraints prevent delete, deactivate instead
      console.log(`[DELETE_USER] Hard delete failed for user ${id}, falling back to deactivation. Error:`, dbError.message);
      
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: "User has historic business records (appointments/invoices) and cannot be deleted. Their login has been deactivated instead.",
        deactivated: true
      });
    }
  } catch (error) {
    console.error("[DELETE_USER]", error);
    return NextResponse.json({ success: false, error: "Failed to process user deletion" }, { status: 500 });
  }
}
