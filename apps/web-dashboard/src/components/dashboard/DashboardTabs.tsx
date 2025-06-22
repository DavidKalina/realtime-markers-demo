"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Calendar,
  MapPin,
  Plus,
  Search,
  Users,
  Loader2,
} from "lucide-react";
import { useRoutePreloader } from "@/utils/preloadUtils";

const tabs = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    name: "Query Insights",
    href: "/query-insights",
    icon: Search,
  },
  {
    name: "Events",
    href: "/events",
    icon: Calendar,
  },
  {
    name: "Create Event",
    href: "/events/create",
    icon: Plus,
  },
  {
    name: "Map",
    href: "/map",
    icon: MapPin,
  },
  {
    name: "Users",
    href: "/users",
    icon: Users,
  },
];

export function DashboardTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const { preloadRoute } = useRoutePreloader();

  // Reset loading state when pathname changes
  useEffect(() => {
    setLoadingTab(null);
    setIsNavigating(false);
  }, [pathname]);

  const handleTabClick = async (tab: (typeof tabs)[0]) => {
    if (pathname === tab.href || isNavigating) return;

    setLoadingTab(tab.name);
    setIsNavigating(true);

    try {
      // Add a small delay to show loading state for better UX
      await new Promise((resolve) => setTimeout(resolve, 100));
      router.push(tab.href);
    } catch (error) {
      console.error("Navigation error:", error);
      setLoadingTab(null);
      setIsNavigating(false);
    }
  };

  const handleTabHover = (tab: (typeof tabs)[0]) => {
    // Preload the route on hover
    preloadRoute(tab.href);
  };

  return (
    <div className="border-b">
      <div className="flex space-x-8">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const isLoading = loadingTab === tab.name;
          const isDisabled = isNavigating && !isLoading;

          return (
            <button
              key={tab.name}
              onClick={() => handleTabClick(tab)}
              onMouseEnter={() => handleTabHover(tab)}
              disabled={isDisabled}
              className={cn(
                "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 relative",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground",
                isDisabled && "opacity-50 cursor-not-allowed",
                isLoading && "cursor-wait",
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <tab.icon className="h-4 w-4" />
              )}
              <span>{tab.name}</span>

              {/* Loading indicator bar */}
              {isLoading && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
