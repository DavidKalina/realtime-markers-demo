"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { BannerConfigPanel } from "@/components/dashboard/BannerConfigPanel";

export default function BannerConfigPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Banner Configuration
            </h2>
            <p className="text-muted-foreground">
              Customize the municipal banner that appears across all pages
            </p>
          </div>

          <BannerConfigPanel />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
