"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { OverviewDashboard } from "@/components/dashboard/OverviewDashboard";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function DashboardPage() {
  const { overview, llmCosts, loading } = useDashboardData();

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {loading || !overview ? (
          <LoadingSpinner />
        ) : (
          <OverviewDashboard data={overview} llmCosts={llmCosts} />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
