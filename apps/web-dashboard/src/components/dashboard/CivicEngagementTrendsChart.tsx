"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { CivicEngagementTrends } from "@/services/api";

interface CivicEngagementTrendsChartProps {
  trends: CivicEngagementTrends;
  className?: string;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function CivicEngagementTrendsChart({
  trends,
  className,
}: CivicEngagementTrendsChartProps) {
  // Prepare growth rates data for bar chart
  const growthData = trends.growthRates.map((rate) => ({
    type: rate.type,
    growth: rate.engagementCreationGrowth,
    trend: rate.trend,
  }));

  // Prepare weekly data for line chart (using first type as example)
  const weeklyData =
    Object.values(trends.trends.byType)[0]?.weeklyData.map((week) => ({
      week: week.week,
      created: week.engagementsCreated,
      implemented: week.engagementsImplemented,
    })) || [];

  // Prepare type distribution for pie chart
  const typeDistribution = Object.entries(trends.trends.byType).map(
    ([type, data]) => ({
      name: data.type,
      value: data.weeklyData.reduce(
        (sum, week) => sum + week.engagementsCreated,
        0,
      ),
    }),
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Growth Rates Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Growth by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="type"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <Tooltip formatter={(value) => [`${value}%`, "Growth Rate"]} />
              <Bar dataKey="growth" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Weekly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Engagement Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="created"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Created"
              />
              <Line
                type="monotone"
                dataKey="implemented"
                stroke="#10b981"
                strokeWidth={2}
                name="Implemented"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Engagement Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, "Engagements"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Trends Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Weeks Tracked</span>
                <span className="text-lg font-bold">
                  {trends.summary.totalWeeks}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Types Tracked</span>
                <span className="text-lg font-bold">
                  {trends.summary.typesTracked}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Statuses Tracked</span>
                <span className="text-lg font-bold">
                  {trends.summary.statusesTracked}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Trend</span>
                <span
                  className={`text-lg font-bold ${
                    trends.growthRates[0]?.trend === "growing"
                      ? "text-green-600"
                      : trends.growthRates[0]?.trend === "declining"
                        ? "text-red-600"
                        : "text-gray-600"
                  }`}
                >
                  {trends.growthRates[0]?.trend || "stable"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
