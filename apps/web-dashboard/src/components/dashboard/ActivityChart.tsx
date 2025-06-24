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
} from "recharts";
import type { ActivityItem } from "@/lib/dashboard-data";

interface ActivityChartProps {
  activities: ActivityItem[];
  className?: string;
}

export function ActivityChart({ activities, className }: ActivityChartProps) {
  // Group activities by type and count them
  const activityCounts = activities.reduce(
    (acc, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Prepare data for activity type chart
  const activityData = Object.entries(activityCounts).map(([type, count]) => ({
    type: type.replace("_", " "),
    count,
    icon: getActivityIcon(type as ActivityItem["type"]),
  }));

  // Group activities by hour for timeline
  const hourlyData = activities.reduce(
    (acc, activity) => {
      const hour = new Date(activity.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  // Fill in missing hours
  const timelineData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour}:00`,
    count: hourlyData[hour] || 0,
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" interval={2} fontSize={10} />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity Types */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Types</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" fontSize={12} />
              <YAxis />
              <Tooltip
                formatter={(value) => [value, "Activities"]}
                labelFormatter={(label) => {
                  const activity = activityData.find((a) => a.type === label);
                  return `${activity?.icon} ${label}`;
                }}
              />
              <Bar dataKey="count" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function getActivityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "event_scanned":
      return "📱";
    case "user_registered":
      return "👤";
    case "event_created":
      return "🎉";
    case "category_added":
      return "🏷️";
    default:
      return "📋";
  }
}
