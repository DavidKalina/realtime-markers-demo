import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type EventEngagement } from "@/services/api";
import { Eye, Heart, TrendingUp, Users } from "lucide-react";

interface EventEngagementStatsProps {
  engagement: EventEngagement;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

export function EventEngagementStats({
  engagement,
}: EventEngagementStatsProps) {
  const stats = [
    {
      icon: Heart,
      label: "Saves",
      value: engagement.saveCount,
      color: "text-red-500",
      bgColor: "bg-red-50",
    },
    {
      icon: Eye,
      label: "Views",
      value: engagement.viewCount,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      icon: TrendingUp,
      label: "Scans",
      value: engagement.scanCount,
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      icon: Users,
      label: "RSVPs",
      value: engagement.rsvpCount,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Engagement Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center p-4 rounded-lg border"
            >
              <div className={`p-3 rounded-full ${stat.bgColor} mb-2`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {formatNumber(stat.value)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total Engagement */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-foreground" />
            <span className="font-semibold">Total Engagement</span>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {formatNumber(engagement.totalEngagement)}
          </Badge>
        </div>

        {/* RSVP Breakdown */}
        {engagement.rsvpCount > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">
              RSVP Breakdown
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Going</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-200"
                >
                  {engagement.goingCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Not Going</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-red-600 border-red-200"
                >
                  {engagement.notGoingCount}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Last updated: {new Date(engagement.lastUpdated).toLocaleDateString()}{" "}
          at {new Date(engagement.lastUpdated).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
