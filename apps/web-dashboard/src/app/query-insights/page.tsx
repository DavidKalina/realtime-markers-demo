"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { QueryInsightsDashboard } from "@/components/dashboard/QueryInsightsDashboard";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { useQueryInsights } from "@/hooks/useQueryInsights";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Search,
  TrendingUp,
  AlertTriangle,
  XCircle,
} from "lucide-react";

export default function QueryInsightsPage() {
  const [options, setOptions] = useState({
    days: 30,
    limit: 10,
    minSearches: 3,
  });

  const { insights, loading, error, refetch } = useQueryInsights(options);

  const handleRefresh = () => {
    refetch();
  };

  const updateOptions = (newOptions: Partial<typeof options>) => {
    setOptions((prev) => ({ ...prev, ...newOptions }));
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <LoadingSpinner />
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <Card className="max-w-md mx-auto mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Error Loading Query Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRefresh} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Query Insights
              </h1>
              <p className="text-muted-foreground">
                Analyze search patterns and optimize user experience
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                Last {options.days} days
              </Badge>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          {insights && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Queries
                  </CardTitle>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {insights.summary.totalQueries}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unique search terms
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Searches
                  </CardTitle>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {insights.summary.totalSearches}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Search executions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg Hit Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(insights.summary.averageHitRate ?? 0).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Successful searches
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Zero Hits
                  </CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {insights.summary.zeroHitQueries}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No results found
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Low Hit Rate
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {insights.summary.lowHitQueries}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    &lt;50% success rate
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Dashboard Content */}
          {insights && <QueryInsightsDashboard insights={insights} />}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
