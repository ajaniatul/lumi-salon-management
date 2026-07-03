// =====================================================
// GLOBAL TYPE DEFINITIONS — Salon Management System
// =====================================================

import type { ElementType } from "react";
import type {
  User,
  Customer,
  Staff,
  Service,
  Product,
  Appointment,
  Invoice,
  InvoiceItem,
  Payment,
  Attendance,
  Commission,
  Membership,
  CustomerMembership,
  Role,
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
  MembershipTier,
  Gender,
  AttendanceStatus,
  ExpenseCategory,
} from "@prisma/client";

// ─── Re-exports for convenience ───────────────────────────
export type {
  Role,
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
  MembershipTier,
  Gender,
  AttendanceStatus,
  ExpenseCategory,
};

// Category types are now admin-configurable strings
export type ServiceCategory = string;
export type ProductCategory = string;

// ─── Auth ─────────────────────────────────────────────────
export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  staffId?: string;
  avatar?: string;
}

// ─── API Response ─────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Dashboard ────────────────────────────────────────────
export interface DashboardStats {
  revenue: {
    today: number;
    thisMonth: number;
    lastMonth: number;
    monthGrowth: number; // percentage change
  };
  appointments: {
    today: number;
    pending: number;
    completed: number;
    cancelled: number;
  };
  customers: {
    total: number;
    newToday: number;
    newThisMonth: number;
  };
  pendingPayments: number;
  lowStockCount: number;
  topServices: Array<{ name: string; count: number; revenue: number }>;
  topStaff: Array<{ name: string; appointments: number; revenue: number }>;
  revenueChart: Array<{ date: string; revenue: number; appointments: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

// ─── Appointment ──────────────────────────────────────────
export interface AppointmentWithRelations extends Appointment {
  customer: Pick<Customer, "id" | "name" | "phone">;
  staff: Pick<Staff, "id" | "name" | "designation" | "avatar">;
  services: Array<{
    id: string;
    service: Pick<Service, "id" | "name" | "duration" | "price">;
    price: number;
    duration: number;
  }>;
  invoice?: Pick<Invoice, "id" | "invoiceNumber" | "paymentStatus" | "totalAmount"> | null;
}

// Booking form payload
export interface CreateAppointmentInput {
  customerId: string;
  staffId: string;
  date: string; // ISO date string
  startTime: string; // HH:mm
  serviceIds: string[];
  notes?: string;
  source?: string;
}

// ─── Customer ─────────────────────────────────────────────
export interface CustomerWithStats extends Customer {
  membership?: CustomerMembership & { membership: Membership } | null;
  _count?: { appointments: number; invoices: number };
}

// ─── Invoice / Billing ────────────────────────────────────
export interface InvoiceWithRelations extends Invoice {
  customer: Pick<Customer, "id" | "name" | "phone" | "email">;
  items: (InvoiceItem & {
    service?: Pick<Service, "id" | "name"> | null;
    product?: Pick<Product, "id" | "name"> | null;
  })[];
  payments: Payment[];
}

export interface BillingItem {
  type: "SERVICE" | "PRODUCT";
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount?: number;
}

// ─── Staff Dashboard ──────────────────────────────────────
export interface StaffWithAttendance extends Staff {
  todayAttendance?: Pick<Attendance, "status" | "clockIn" | "clockOut"> | null;
  thisMonthCommission?: Pick<Commission, "totalAmount" | "isPaid"> | null;
}

// ─── Calendar ─────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    appointmentId: string;
    customerId: string;
    customerName: string;
    staffId: string;
    staffName: string;
    status: AppointmentStatus;
    services: string[];
  };
}

// ─── Form Inputs ──────────────────────────────────────────
export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: Gender;
  anniversary?: string;
  address?: string;
  notes?: string;
  preferredStaffId?: string;
}

export interface CreateServiceInput {
  serviceCode: string;
  name: string;
  description?: string;
  category: ServiceCategory;
  price: number;
  duration: number;
  gstRate?: number;
}

export interface CreateProductInput {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category: ProductCategory;
  brand?: string;
  price: number;
  costPrice: number;
  mrp?: number;
  gstRate?: number;
  stockQuantity?: number;
  minStockLevel?: number;
  unit?: string;
  supplierId?: string;
}

// ─── Filters ──────────────────────────────────────────────
export interface DateRange {
  from: Date;
  to: Date;
}

export interface AppointmentFilters {
  date?: string;
  staffId?: string;
  status?: AppointmentStatus;
  search?: string;
}

export interface InvoiceFilters {
  paymentStatus?: PaymentStatus;
  dateRange?: DateRange;
  search?: string;
}

// ─── Notification ─────────────────────────────────────────
export interface SendNotificationInput {
  customerId: string;
  type: "APPOINTMENT_REMINDER" | "BIRTHDAY" | "INVOICE" | "PROMOTIONAL" | "MEMBERSHIP_EXPIRY";
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  data: Record<string, unknown>;
}

// ─── Report ───────────────────────────────────────────────
export interface SalesReport {
  period: string;
  totalRevenue: number;
  serviceRevenue: number;
  productRevenue: number;
  totalInvoices: number;
  averageOrderValue: number;
  topServices: Array<{ name: string; revenue: number; count: number }>;
  topProducts: Array<{ name: string; revenue: number; count: number }>;
  paymentBreakdown: Record<PaymentMethod, number>;
}

// ─── UI ───────────────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  badge?: number;
  roles?: Role[];
  children?: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
