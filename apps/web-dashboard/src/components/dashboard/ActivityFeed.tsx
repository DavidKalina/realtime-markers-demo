import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ActivityItem {
  id: string;
  type:
    | "event_scanned"
    | "user_registered"
    | "event_created"
    | "category_added";
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, string | number | boolean>;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
}

const getActivityIcon = (type: ActivityItem["type"]) => {
  switch (type) {
    case "event_scanned":
      return "📱";
    case "user_registered":
      return "👤";
    case "event_created":
      return "🎉";
    case "category_added":
      return "🏷️";
    default:
      return "📋";
  }
};

const getActivityColor = (type: ActivityItem["type"]) => {
  switch (type) {
    case "event_scanned":
      return "bg-blue-100 text-blue-800";
    case "user_registered":
      return "bg-green-100 text-green-800";
    case "event_created":
      return "bg-purple-100 text-purple-800";
    case "category_added":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Recent Activity
          <Badge variant="secondary" className="text-xs">
            {activities.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No recent activity</p>
          </div>
        ) : (
          activities.map((activity, index) => (
            <div key={activity.id}>
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={getActivityColor(activity.type)}>
                    {getActivityIcon(activity.type)}
                  </AvatarFallback>
                  {activity.user?.avatar && (
                    <AvatarImage
                      src={activity.user.avatar}
                      alt={activity.user.name}
                    />
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {activity.title}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {activity.type.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
              {index < activities.length - 1 && <Separator className="mt-4" />}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
