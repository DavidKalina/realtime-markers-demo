import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No upcoming events</p>
            </div>
          ) : (
            events.map((event) => {
              const status = getEventStatus(event);
              const attendancePercentage = event.maxAttendees
                ? Math.round((event.attendees / event.maxAttendees) * 100)
                : null;

              return (
                <div key={event.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{event.category.emoji}</span>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{event.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.location}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={status === "ongoing" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {status}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {event.description}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        📅 {formatDate(event.startDate)}
                      </span>
                      <span className="text-muted-foreground">
                        👥 {event.attendees}
                        {event.maxAttendees && `/${event.maxAttendees}`}
                      </span>
                    </div>

                    {attendancePercentage !== null && (
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(attendancePercentage, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-muted-foreground">
                          {attendancePercentage}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
