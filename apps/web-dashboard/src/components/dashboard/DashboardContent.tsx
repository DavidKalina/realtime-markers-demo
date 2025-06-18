import { ActivityFeed } from "./ActivityFeed";
import { QuickStats } from "./QuickStats";
import { UpcomingEvents } from "./UpcomingEvents";
import type {
  ActivityItem,
  CategoryStat,
  TimeStat,
} from "@/lib/dashboard-data";

// Import the Event type that UpcomingEvents expects
interface DashboardEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  category: {
    name: string;
    emoji: string;
  };
  attendees: number;
  maxAttendees?: number;
}

interface DashboardContentProps {
  activities: ActivityItem[];
  popularCategories: CategoryStat[];
  busiestTimes: TimeStat[];
  upcomingEvents: DashboardEvent[];
  className?: string;
}

export function DashboardContent({
  activities,
  popularCategories,
  busiestTimes,
  upcomingEvents,
  className,
}: DashboardContentProps) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${className}`}>
      {/* Left Column - Activity Feed */}
      <div className="lg:col-span-1">
        <ActivityFeed activities={activities} />
      </div>

      {/* Right Column - Quick Stats and Upcoming Events */}
      <div className="lg:col-span-2 space-y-8">
        <QuickStats
          popularCategories={popularCategories}
          busiestTimes={busiestTimes}
        />
        <UpcomingEvents events={upcomingEvents} />
      </div>
    </div>
  );
}
