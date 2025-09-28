"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryStat, TimeStat } from "@/lib/dashboard-data";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface EventsOverviewProps {
  categories: CategoryStat[];
  busiestTimes: TimeStat[];
  className?: string;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

export function EventsOverview({
  categories,
  busiestTimes,
  className,
}: EventsOverviewProps) {
  // Prepare category data for bar chart
  const categoryData = categories.slice(0, 8).map((category) => ({
    name: category.name,
    events: category.metrics.totalEvents,
    scans: category.metrics.totalScans,
    emoji: category.emoji,
  }));

  // Prepare time data for heatmap-style visualization
  const timeData = busiestTimes.slice(0, 7).map((timeStat) => ({
    name: `${timeStat.day} ${timeStat.time}`,
    events: timeStat.count,
  }));

  // Prepare engagement metrics for pie chart
  const engagementData = categories.slice(0, 6).map((category) => ({
    name: category.name,
    value: category.metrics.totalScans,
    emoji: category.emoji,
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Category Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === "events" ? "Events" : "Scans",
                ]}
                labelFormatter={(label) => {
                  const category = categoryData.find((c) => c.name === label);
                  return `${category?.emoji} ${label}`;
                }}
              />
              <Bar dataKey="events" fill="#3b82f6" name="Events" />
              <Bar dataKey="scans" fill="#10b981" name="Scans" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Busiest Times Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Busiest Times</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={11}
              />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="events"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Engagement Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Scan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={engagementData}
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
                  {engagementData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [value, "Scans"]}
                  labelFormatter={(label) => {
                    const category = engagementData.find(
                      (c) => c.name === label,
                    );
                    return `${category?.emoji} ${label}`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Categories Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categories.slice(0, 5).map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.emoji}</span>
                    <div>
                      <p className="font-medium text-sm">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.metrics.totalEvents} events
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">
                      {category.metrics.totalScans}
                    </p>
                    <p className="text-xs text-muted-foreground">scans</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
