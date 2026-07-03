"use client";

import {
  IndianRupee,
  TrendingUp,
  Clock,
  Users,
  Calendar,
  Scissors,
  AlertTriangle,
} from "lucide-react";
import { StatsCard } from "./StatsCard";
import { formatCurrencyCompact } from "@/lib/utils";

interface DashboardStatsGridProps {
  todayRevenue: number;
  monthRevenue: number;
  monthGrowth: number;
  pendingAmount: number;
  pendingCount: number;
  totalCustomers: number;
  newCustomersMonth: number;
  newCustomersToday: number;
  appointmentsTotal: number;
  appointmentsCompleted: number;
  appointmentsInProgress: number;
  lowStockCount: number;
}

export function DashboardStatsGrid({
  todayRevenue,
  monthRevenue,
  monthGrowth,
  pendingAmount,
  pendingCount,
  totalCustomers,
  newCustomersMonth,
  newCustomersToday,
  appointmentsTotal,
  appointmentsCompleted,
  appointmentsInProgress,
  lowStockCount,
}: DashboardStatsGridProps) {
  return (
    <>
      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Today's Revenue"
          value={formatCurrencyCompact(todayRevenue)}
          subtitle={`${appointmentsCompleted} service${appointmentsCompleted === 1 ? "" : "s"} done`}
          icon={IndianRupee}
          iconColor="bg-primary-100"
        />
        <StatsCard
          title="Monthly Revenue"
          value={formatCurrencyCompact(monthRevenue)}
          change={monthGrowth}
          changeLabel="vs last month"
          icon={TrendingUp}
          iconColor="bg-accent-100"
        />
        <StatsCard
          title="Pending Payments"
          value={formatCurrencyCompact(pendingAmount)}
          subtitle={`${pendingCount} invoices`}
          icon={Clock}
          iconColor="bg-amber-100"
          trend="down"
        />
        <StatsCard
          title="Total Customers"
          value={totalCustomers.toLocaleString()}
          subtitle={`+${newCustomersMonth} this month`}
          icon={Users}
          iconColor="bg-blue-100"
          trend="up"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Today's Appointments"
          value={String(appointmentsTotal)}
          subtitle={`${appointmentsCompleted} completed`}
          icon={Calendar}
          iconColor="bg-emerald-100"
        />
        <StatsCard
          title="In Progress"
          value={String(appointmentsInProgress)}
          subtitle="Currently serving"
          icon={Scissors}
          iconColor="bg-purple-100"
        />
        <StatsCard
          title="New Customers"
          value={String(newCustomersToday)}
          subtitle="Walk-ins today"
          icon={Users}
          iconColor="bg-primary-100"
        />
        <StatsCard
          title="Low Stock Alerts"
          value={String(lowStockCount)}
          subtitle="Products to reorder"
          icon={AlertTriangle}
          iconColor="bg-red-100"
          trend={lowStockCount > 0 ? "down" : "neutral"}
        />
      </div>
    </>
  );
}
