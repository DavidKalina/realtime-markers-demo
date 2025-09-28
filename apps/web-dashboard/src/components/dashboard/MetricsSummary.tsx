"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

interface MetricsSummaryProps {
  totalEvents: number;
  totalScans: number;
  totalUsers: number;
  scanRate: number; // percentage of events that have been scanned
  userGrowth: number; // percentage growth from last month
  scanGrowth: number; // percentage growth from last week
  className?: string;
}

export function MetricsSummary({
  totalEvents,
  totalScans,
  totalUsers,
  scanRate,
  userGrowth,
  scanGrowth,
  className,
}: MetricsSummaryProps) {
  const getTrendIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (growth < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getTrendColor = (growth: number) => {
    if (growth > 0) return "text-green-600";
    if (growth < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}
    >
      {/* Total Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          <span className="text-2xl">📅</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {totalEvents.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Active events</p>
        </CardContent>
      </Card>

      {/* Total Scans */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
          <span className="text-2xl">📱</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {totalScans.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {getTrendIcon(scanGrowth)}
            <span className={`text-xs ${getTrendColor(scanGrowth)}`}>
              {scanGrowth > 0 ? "+" : ""}
              {scanGrowth}% this week
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Total Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <span className="text-2xl">👥</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {totalUsers.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {getTrendIcon(userGrowth)}
            <span className={`text-xs ${getTrendColor(userGrowth)}`}>
              {userGrowth > 0 ? "+" : ""}
              {userGrowth}% this month
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Scan Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Scan Rate</CardTitle>
          <span className="text-2xl">📊</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{scanRate}%</div>
          <div className="mt-2">
            <Progress value={scanRate} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Events with scans
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
