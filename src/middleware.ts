import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/api/auth/login", "/signup", "/api/auth/signup"];

// Routes accessible to all authenticated roles
const ALL_ROLES_ROUTES = ["/dashboard", "/api/dashboard"];

// Role-specific protected routes
const MANAGER_ROUTES = [
  "/staff",
  "/expenses",
  "/purchases",
  "/inventory",
  "/reports",
  "/analytics",
  "/commission",
  "/api/staff",
  "/api/expenses",
  "/api/purchases",
  "/api/inventory",
  "/api/reports",
  "/api/commission",
];

const ADMIN_ROUTES = [
  "/settings",
  "/api/settings",
  "/api/admin",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes without auth
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Verify session
  const session = await getSessionFromRequest(request);

  // Not logged in → redirect to login
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based access control
  const { role } = session;

  // Admin-only routes
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r)) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
  }

  // Manager+ routes
  if (
    MANAGER_ROUTES.some((r) => pathname.startsWith(r)) &&
    role !== "ADMIN" &&
    role !== "MANAGER"
  ) {
    return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
  }

  // Stylist can only access limited routes
  if (role === "STYLIST") {
    const allowedForStylist = ["/dashboard", "/appointments", "/attendance", "/api"];
    if (!allowedForStylist.some((r) => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
    }
  }

  // Inject user info into headers for server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-user-name", session.name);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
