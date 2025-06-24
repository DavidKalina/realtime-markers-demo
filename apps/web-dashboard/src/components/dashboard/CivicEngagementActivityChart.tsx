"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { CivicEngagementActivity } from "@/services/api";

interface CivicEngagementActivityChartProps {
  activities: CivicEngagementActivity[];
  className?: string;
}

const COLORS = {
  engagement_created: "#3b82f6",
  engagement_updated: "#f59e0b",
  engagement_implemented: "#10b981",
};

const LABELS = {
  engagement_created: "Created",
  engagement_updated: "Updated",
  engagement_implemented: "Implemented",
};

export function CivicEngagementActivityChart({
  activities,
  className,
}: CivicEngagementActivityChartProps) {
  // Group activities by type
  const activityCounts = activities.reduce(
    (acc, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Prepare data for activity type chart
  const activityData = Object.entries(activityCounts).map(([type, count]) => ({
    type: LABELS[type as keyof typeof LABELS] || type,
    count,
    color: COLORS[type as keyof typeof COLORS] || "#6b7280",
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

  // Group by engagement type
  const engagementTypeData = activities.reduce(
    (acc, activity) => {
      const type = String(activity.metadata?.engagementType || "Unknown");
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const typeData = Object.entries(engagementTypeData).map(([type, count]) => ({
    name: type,
    value: count,
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
            <BarChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" interval={2} fontSize={10} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <Tooltip formatter={(value) => [value, "Activities"]} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Engagement Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        COLORS[
                          Object.keys(COLORS)[
                            index % Object.keys(COLORS).length
                          ] as keyof typeof COLORS
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, "Activities"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
