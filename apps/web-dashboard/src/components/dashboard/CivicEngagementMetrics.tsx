"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  Users,
  MapPin,
  Image,
  TrendingUp,
  Clock,
  CheckCircle,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import type { CivicEngagementMetrics } from "@/services/api";

interface CivicEngagementMetricsProps {
  metrics: CivicEngagementMetrics;
}

const COLORS = {
  POSITIVE_FEEDBACK: "#10b981",
  NEGATIVE_FEEDBACK: "#ef4444",
  IDEA: "#3b82f6",
  PENDING: "#f59e0b",
  IN_REVIEW: "#8b5cf6",
  IMPLEMENTED: "#10b981",
  CLOSED: "#6b7280",
};

const TYPE_LABELS = {
  POSITIVE_FEEDBACK: "Positive Feedback",
  NEGATIVE_FEEDBACK: "Negative Feedback",
  IDEA: "Ideas",
};

const STATUS_LABELS = {
  PENDING: "Pending",
  IN_REVIEW: "In Review",
  IMPLEMENTED: "Implemented",
  CLOSED: "Closed",
};

export function CivicEngagementMetrics({
  metrics,
}: CivicEngagementMetricsProps) {
  // Prepare data for type distribution chart
  const typeData = Object.entries(metrics.engagementsByType).map(
    ([type, count]) => ({
      name: TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type,
      value: count,
      color: COLORS[type as keyof typeof COLORS] || "#6b7280",
    }),
  );

  // Prepare data for status distribution chart
  const statusData = Object.entries(metrics.engagementsByStatus).map(
    ([status, count]) => ({
      name: STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status,
      value: count,
      color: COLORS[status as keyof typeof COLORS] || "#6b7280",
    }),
  );

  // Prepare data for recent activity chart
  const recentActivityData = [
    { name: "This Month", engagements: metrics.recentActivity.thisMonth },
    { name: "This Week", engagements: metrics.recentActivity.thisWeek },
    {
      name: "Implemented",
      engagements: metrics.recentActivity.implementedThisMonth,
    },
  ];

  // Prepare data for participation metrics
  const participationData = [
    {
      name: "With Location",
      value: metrics.participation.withLocation,
      total: metrics.totalEngagements,
    },
    {
      name: "With Images",
      value: metrics.participation.withImages,
      total: metrics.totalEngagements,
    },
    {
      name: "Unique Creators",
      value: metrics.participation.uniqueCreators,
      total: metrics.totalEngagements,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Engagements */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Engagements
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.totalEngagements.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.summary.avgEngagementsPerMonth} avg per month
            </p>
          </CardContent>
        </Card>

        {/* Implementation Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Implementation Rate
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.summary.implementationRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.recentActivity.implementedThisMonth} implemented this
              month
            </p>
          </CardContent>
        </Card>

        {/* Unique Creators */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Unique Creators
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.participation.uniqueCreators}
            </div>
            <p className="text-xs text-muted-foreground">
              Active community members
            </p>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Activity
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.recentActivity.thisWeek}
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Types</CardTitle>
            <CardDescription>Distribution of engagement types</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({
                    name,
                    percent,
                  }: {
                    name: string;
                    percent: number;
                  }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Status</CardTitle>
            <CardDescription>Current status of all engagements</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({
                    name,
                    percent,
                  }: {
                    name: string;
                    percent: number;
                  }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Engagement activity over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={recentActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="engagements" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Participation Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Participation Metrics</CardTitle>
            <CardDescription>Engagement quality indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {participationData.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.value} / {item.total}
                  </span>
                </div>
                <Progress
                  value={(item.value / item.total) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Summary</CardTitle>
          <CardDescription>Key performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics.summary.implementationRate}%
              </div>
              <div className="text-sm text-muted-foreground">
                Implementation Rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {metrics.summary.locationCoverage}%
              </div>
              <div className="text-sm text-muted-foreground">
                Location Coverage
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {metrics.summary.mediaCoverage}%
              </div>
              <div className="text-sm text-muted-foreground">
                Media Coverage
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {metrics.summary.avgEngagementsPerMonth}
              </div>
              <div className="text-sm text-muted-foreground">Avg per Month</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
