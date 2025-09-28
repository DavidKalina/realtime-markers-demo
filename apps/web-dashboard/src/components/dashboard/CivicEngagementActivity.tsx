"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CivicEngagementActivity } from "@/services/api";
import { CheckCircle, Clock, Edit, MessageSquare } from "lucide-react";

interface CivicEngagementActivityProps {
  activities: CivicEngagementActivity[];
}

const ACTIVITY_ICONS = {
  engagement_created: MessageSquare,
  engagement_updated: Edit,
  engagement_implemented: CheckCircle,
};

const ACTIVITY_COLORS = {
  engagement_created: "text-blue-600",
  engagement_updated: "text-yellow-600",
  engagement_implemented: "text-green-600",
};

const ACTIVITY_LABELS = {
  engagement_created: "Created",
  engagement_updated: "Updated",
  engagement_implemented: "Implemented",
};

export function CivicEngagementActivity({
  activities,
}: CivicEngagementActivityProps) {
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor(
      (now.getTime() - activityTime.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest civic engagement activities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>No recent activity</p>
            </div>
          ) : (
            activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const color = ACTIVITY_COLORS[activity.type];
              const label = ACTIVITY_LABELS[activity.type];

              return (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className={`p-2 rounded-full bg-muted ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {label}
                        </Badge>
                        {activity.user && (
                          <div className="flex items-center space-x-1">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={activity.user.avatar} />
                              <AvatarFallback className="text-xs">
                                {getInitials(activity.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {activity.user.name}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>

                    <h4 className="font-medium text-sm mt-1">
                      {activity.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.description}
                    </p>

                    {activity.metadata && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {activity.metadata.engagementType && (
                          <Badge variant="secondary" className="text-xs">
                            {activity.metadata.engagementType}
                          </Badge>
                        )}
                        {activity.metadata.engagementStatus && (
                          <Badge variant="outline" className="text-xs">
                            {activity.metadata.engagementStatus}
                          </Badge>
                        )}
                        {activity.metadata.hasLocation && (
                          <Badge variant="outline" className="text-xs">
                            📍 Has Location
                          </Badge>
                        )}
                        {activity.metadata.hasImages && (
                          <Badge variant="outline" className="text-xs">
                            🖼️ Has Images
                          </Badge>
                        )}
                        {activity.metadata.hasAdminNotes && (
                          <Badge variant="outline" className="text-xs">
                            📝 Has Notes
                          </Badge>
                        )}
                        {activity.metadata.daysToImplement && (
                          <Badge variant="outline" className="text-xs">
                            ⏱️ {activity.metadata.daysToImplement} days
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {activities.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Showing {activities.length} most recent activities
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
