"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  Users,
} from "lucide-react";
import type { CivicEngagementTrends } from "@/services/api";

interface CivicEngagementTrendsProps {
  trends: CivicEngagementTrends;
}

const TREND_ICONS = {
  growing: TrendingUp,
  declining: TrendingDown,
  stable: Minus,
};

const TREND_COLORS = {
  growing: "text-green-600",
  declining: "text-red-600",
  stable: "text-gray-600",
};

export function CivicEngagementTrends({ trends }: CivicEngagementTrendsProps) {
  const TrendIcon = TREND_ICONS[trends.growthRates[0]?.trend || "stable"];
  const trendColor = TREND_COLORS[trends.growthRates[0]?.trend || "stable"];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Weeks</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trends.summary.totalWeeks}
            </div>
            <p className="text-xs text-muted-foreground">Weeks tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Types Tracked</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trends.summary.typesTracked}
            </div>
            <p className="text-xs text-muted-foreground">Engagement types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Statuses Tracked
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trends.summary.statusesTracked}
            </div>
            <p className="text-xs text-muted-foreground">Status types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Trend</CardTitle>
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${trendColor}`}>
              {trends.growthRates[0]?.trend || "stable"}
            </div>
            <p className="text-xs text-muted-foreground">
              {trends.growthRates[0]?.engagementCreationGrowth.toFixed(1)}%
              growth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Rates by Type</CardTitle>
          <CardDescription>
            Engagement creation growth over the last 12 weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trends.growthRates.map((rate, index) => {
              const Icon = TREND_ICONS[rate.trend];
              const color = TREND_COLORS[rate.trend];

              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div>
                      <h4 className="font-medium">{rate.type}</h4>
                      <p className="text-sm text-muted-foreground">
                        {rate.engagementCreationGrowth.toFixed(1)}% growth
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <Badge
                      variant={
                        rate.trend === "growing"
                          ? "default"
                          : rate.trend === "declining"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {rate.trend}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Data Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Type Trends</CardTitle>
            <CardDescription>
              Weekly engagement creation by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(trends.trends.byType).map(([type, data]) => (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{data.type}</span>
                    <span className="text-sm text-muted-foreground">
                      {data.weeklyData.length} weeks
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total created:{" "}
                    {data.weeklyData.reduce(
                      (sum, week) => sum + week.engagementsCreated,
                      0,
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total implemented:{" "}
                    {data.weeklyData.reduce(
                      (sum, week) => sum + week.engagementsImplemented,
                      0,
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Status Trends</CardTitle>
            <CardDescription>Weekly engagement status changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(trends.trends.byStatus).map(([status, data]) => (
                <div key={status} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{data.status}</span>
                    <span className="text-sm text-muted-foreground">
                      {data.weeklyData.length} weeks
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total count:{" "}
                    {data.weeklyData.reduce(
                      (sum, week) => sum + week.engagementsCount,
                      0,
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Range Info */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Period</CardTitle>
          <CardDescription>Data collection timeframe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm font-medium">Start Date</div>
              <div className="text-sm text-muted-foreground">
                {new Date(trends.summary.startDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">End Date</div>
              <div className="text-sm text-muted-foreground">
                {new Date(trends.summary.endDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Duration</div>
              <div className="text-sm text-muted-foreground">
                {trends.summary.totalWeeks} weeks
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
