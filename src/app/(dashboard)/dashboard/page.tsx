import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { DashboardStatsGrid } from "@/components/dashboard/DashboardStatsGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { AppointmentsWidget } from "@/components/dashboard/AppointmentsWidget";
import { TopServices } from "@/components/dashboard/TopServices";
import { StaffPerformance } from "@/components/dashboard/StaffPerformance";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, format } from "date-fns";

export default async function DashboardPage() {
  const session = await getSession();

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const prevMonthStart = startOfMonth(subDays(monthStart, 1));
  const prevMonthEnd = endOfDay(subDays(monthStart, 1));

  // Run all database queries in parallel
  const [
    todayInvoices,
    monthInvoices,
    prevMonthInvoices,
    pendingInvoices,
    totalCustomers,
    newCustomersToday,
    newCustomersMonth,
    allProducts,
    todayAppointments,
    allStaff,
    invoiceItems,
  ] = await Promise.all([
    // Today's invoices
    prisma.invoice.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      select: { totalAmount: true }
    }),
    // This month's invoices
    prisma.invoice.findMany({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
      select: { totalAmount: true }
    }),
    // Last month's invoices (for MoM calculation)
    prisma.invoice.findMany({
      where: { createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      select: { totalAmount: true }
    }),
    // Pending/Partial invoices
    prisma.invoice.findMany({
      where: { paymentStatus: { in: ["PENDING", "PARTIAL"] } },
      select: { dueAmount: true }
    }),
    // Total Customers
    prisma.customer.count({
      where: { isActive: true }
    }),
    // New Customers Today
    prisma.customer.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, isActive: true }
    }),
    // New Customers This Month
    prisma.customer.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd }, isActive: true }
    }),
    // Fetch products to count low stock (comparing local fields)
    prisma.product.findMany({
      where: { isActive: true },
      select: { stockQuantity: true, minStockLevel: true }
    }),
    // Today's appointments with relations
    prisma.appointment.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: {
        customer: { select: { name: true, phone: true } },
        staff: { select: { name: true } },
        services: {
          include: {
            service: { select: { name: true } }
          }
        }
      },
      orderBy: { startTime: "asc" }
    }),
    // Staff details
    prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    }),
    // Invoice items for top services
    prisma.invoiceItem.findMany({
      where: { invoice: { createdAt: { gte: monthStart, lte: monthEnd } } },
      select: { name: true, unitPrice: true, quantity: true }
    })
  ]);

  // 1. Revenue calculations
  const todayRevenue = todayInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const monthRevenue = monthInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const prevMonthRevenue = prevMonthInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

  // Month-over-month Growth
  let monthGrowth = 0;
  if (prevMonthRevenue > 0) {
    monthGrowth = Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 1000) / 10;
  } else if (monthRevenue > 0) {
    monthGrowth = 100;
  }

  // Pending Payments
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.dueAmount), 0);
  const pendingCount = pendingInvoices.length;

  // Low stock products count
  const lowStockCount = allProducts.filter(p => p.stockQuantity <= p.minStockLevel).length;

  // 2. Appointments stats
  const appointmentsTotal = todayAppointments.length;
  const appointmentsCompleted = todayAppointments.filter(a => a.status === "COMPLETED").length;
  const appointmentsInProgress = todayAppointments.filter(a => a.status === "IN_PROGRESS").length;

  // Format today's appointments for widget
  const formattedTodayAppointments = todayAppointments.map(a => ({
    id: a.id,
    appointmentNo: a.appointmentNo,
    customer: { name: a.customer.name, phone: a.customer.phone || "" },
    staff: { name: a.staff.name },
    startTime: a.startTime.toISOString(),
    endTime: a.endTime.toISOString(),
    duration: a.duration,
    status: a.status,
    services: a.services.map(s => s.service.name)
  }));

  // 3. Top Services calculations (from Invoice Items)
  const serviceSalesMap: Record<string, { count: number; revenue: number }> = {};
  invoiceItems.forEach(item => {
    if (!serviceSalesMap[item.name]) {
      serviceSalesMap[item.name] = { count: 0, revenue: 0 };
    }
    serviceSalesMap[item.name].count += item.quantity;
    serviceSalesMap[item.name].revenue += Number(item.unitPrice) * item.quantity;
  });

  const topServices = Object.entries(serviceSalesMap)
    .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // 4. Staff Performance
  const staffPerformance = await Promise.all(
    allStaff.map(async (s) => {
      const staffInvoices = await prisma.invoice.findMany({
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
          appointment: { staffId: s.id }
        },
        select: { totalAmount: true }
      });
      const revenue = staffInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      return {
        name: s.name,
        appointments: staffInvoices.length,
        revenue
      };
    })
  );

  const displayStaffPerformance = staffPerformance.length > 0 
    ? staffPerformance.sort((a, b) => b.revenue - a.revenue)
    : [];

  // 5. Revenue Chart (last 14 days)
  const chartDaysCount = 14;
  const chartDataMap: Record<string, { date: string; revenue: number; appointments: number }> = {};
  
  // Initialize map with last 14 days
  for (let i = chartDaysCount - 1; i >= 0; i--) {
    const dateObj = new Date();
    dateObj.setDate(now.getDate() - i);
    const dateLabel = format(dateObj, "dd MMM");
    chartDataMap[dateLabel] = { date: dateLabel, revenue: 0, appointments: 0 };
  }

  // Fetch invoices in the last 14 days
  const chartStartDate = startOfDay(subDays(new Date(), chartDaysCount - 1));
  const recentInvoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: chartStartDate } },
    select: { totalAmount: true, createdAt: true }
  });

  recentInvoices.forEach(inv => {
    const label = format(inv.createdAt, "dd MMM");
    if (chartDataMap[label]) {
      chartDataMap[label].revenue += Number(inv.totalAmount);
    }
  });

  // Fetch appointments in the last 14 days
  const recentAppointments = await prisma.appointment.findMany({
    where: { date: { gte: chartStartDate } },
    select: { date: true }
  });

  recentAppointments.forEach(apt => {
    const label = format(apt.date, "dd MMM");
    if (chartDataMap[label]) {
      chartDataMap[label].appointments += 1;
    }
  });

  const revenueChartData = Object.values(chartDataMap);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">
          {greeting}, {session?.name?.split(" ")[0]} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {formatDate(new Date(), "EEEE, dd MMMM yyyy")} · Here&apos;s your salon overview
        </p>
      </div>

      {/* Stats Grid */}
      <DashboardStatsGrid
        todayRevenue={todayRevenue}
        monthRevenue={monthRevenue}
        monthGrowth={monthGrowth}
        pendingAmount={pendingAmount}
        pendingCount={pendingCount}
        totalCustomers={totalCustomers}
        newCustomersMonth={newCustomersMonth}
        newCustomersToday={newCustomersToday}
        appointmentsTotal={appointmentsTotal}
        appointmentsCompleted={appointmentsCompleted}
        appointmentsInProgress={appointmentsInProgress}
        lowStockCount={lowStockCount}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueChartData} />
        </div>
        <TopServices services={topServices} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AppointmentsWidget appointments={formattedTodayAppointments} />
        <StaffPerformance staff={displayStaffPerformance} />
      </div>
    </div>
  );
}
