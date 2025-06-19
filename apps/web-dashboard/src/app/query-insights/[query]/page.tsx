"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Search,
  Clock,
  Target,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardDataService, type QueryStats } from "@/lib/dashboard-data";

export default function QueryDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const query = decodeURIComponent(params.query as string);

  const [stats, setStats] = useState<QueryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQueryStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const queryStats = await DashboardDataService.getQueryStats(query);
        setStats(queryStats);
      } catch (err) {
        console.error("Failed to load query stats:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load query stats",
        );
      } finally {
        setLoading(false);
      }
    };

    if (query) {
      loadQueryStats();
    }
  }, [query]);

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <LoadingSpinner />
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (error || !stats) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <Card className="max-w-md mx-auto mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Query Not Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {error || "No statistics available for this query"}
              </p>
              <Button onClick={() => router.back()} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Query Details
              </h1>
              <p className="text-muted-foreground">
                Statistics for:{" "}
                <span className="font-mono bg-muted px-2 py-1 rounded">
                  {query}
                </span>
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Searches
                </CardTitle>
                <Search className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSearches}</div>
                <p className="text-xs text-muted-foreground">Times searched</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Hits
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalHits}</div>
                <p className="text-xs text-muted-foreground">
                  Successful results
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.hitRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Success rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Results
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.averageResults.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">Per search</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Search Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">First Searched</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(stats.firstSearched)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Last Searched</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(stats.lastSearched)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Top Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topResults.length > 0 ? (
                  <div className="space-y-2">
                    {stats.topResults.slice(0, 5).map((result, index) => (
                      <div key={result} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <span className="text-sm font-mono">{result}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No top results available
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
