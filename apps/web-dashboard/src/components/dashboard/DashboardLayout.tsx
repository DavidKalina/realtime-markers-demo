"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DashboardTabs } from "./DashboardTabs";
import { LayoutWrapper } from "@/components/LayoutWrapper";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <LayoutWrapper>
      <div className="container mx-auto p-8">
        {/* Header with user info and logout */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.displayName || user?.email}!
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Tab Navigation */}
        <DashboardTabs />

        {/* Page Content */}
        <div className="mt-8">{children}</div>
      </div>
    </LayoutWrapper>
  );
}
