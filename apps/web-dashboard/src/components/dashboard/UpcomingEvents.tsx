import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Event {
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

interface UpcomingEventsProps {
  events: Event[];
  className?: string;
}

export function UpcomingEvents({ events, className }: UpcomingEventsProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Tomorrow";
    if (diffInDays < 7) return `${diffInDays} days`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getEventStatus = (event: Event) => {
    const now = new Date();
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    if (now < startDate) return "upcoming";
    if (now >= startDate && now <= endDate) return "ongoing";
    return "past";
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Upcoming Events
          <Badge variant="outline" className="text-xs">
            {events.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No upcoming events</p>
          </div>
        ) : (
          <div className="divide-y">
            {events.map((event) => {
              const status = getEventStatus(event);

              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="text-base shrink-0">
                    {event.category.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {event.title}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.location} · {event.attendees} attending ·{" "}
                      {formatDate(event.startDate)}
                    </p>
                  </div>
                  <Badge
                    variant={status === "ongoing" ? "default" : "secondary"}
                    className="text-xs shrink-0"
                  >
                    {status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
