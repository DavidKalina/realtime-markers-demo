"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BarChart3, Calendar, MapPin, Plus, Search, Users } from "lucide-react";

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

  return (
    <div className="border-b">
      <div className="flex space-x-8">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <button
              key={tab.name}
              onClick={() => router.push(tab.href)}
              className={cn(
                "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
