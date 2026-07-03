"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;       // percentage change vs previous period
  changeLabel?: string;  // e.g. "vs last month"
  icon: LucideIcon;
  iconColor?: string;    // tailwind bg color class
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  subtitle,
  change,
  changeLabel = "vs last month",
  icon: Icon,
  iconColor = "bg-primary-100",
  trend,
  loading = false,
}: StatsCardProps) {

  if (loading) {
    return (
      <div className="card-luxury p-5">
        <div className="flex items-start justify-between">
          <div className="skeleton w-9 h-9 rounded-xl" />
          <div className="skeleton w-16 h-5 rounded" />
        </div>
        <div className="mt-4">
          <div className="skeleton w-24 h-7 rounded mb-1.5" />
          <div className="skeleton w-32 h-4 rounded" />
        </div>
      </div>
    );
  }

  // Determine trend direction
  const trendDir = trend ?? (
    change !== undefined
      ? change > 0 ? "up" : change < 0 ? "down" : "neutral"
      : "neutral"
  );

  const TrendIcon = trendDir === "up" ? TrendingUp : trendDir === "down" ? TrendingDown : Minus;
  const trendColor = trendDir === "up"
    ? "text-emerald-600 bg-emerald-50"
    : trendDir === "down"
    ? "text-red-500 bg-red-50"
    : "text-gray-500 bg-gray-100";

  return (
    <div className="card-luxury p-5 group">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconColor)}>
          <Icon className="w-5 h-5" style={{ color: "#B76E79" }} />
        </div>

        {change !== undefined && (
          <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg", trendColor)}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-4">
        <p className="text-2xl font-display font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>
        )}
        {change !== undefined && changeLabel && (
          <p className="text-xs text-muted-foreground mt-2">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
