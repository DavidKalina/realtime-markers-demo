import { useEvent } from "@/hooks/useEvent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, MapPin, Users, RefreshCw } from "lucide-react";

interface EventDetailExampleProps {
  eventId: string;
}

export function EventDetailExample({ eventId }: EventDetailExampleProps) {
  const { event, loading, error, refetch } = useEvent(eventId);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading event...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !event) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-destructive">
                Error Loading Event
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error || "Event not found"}
              </p>
            </div>
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>{event.title}</span>
            <Badge variant="outline">{event.category?.name}</Badge>
          </CardTitle>
          <Button onClick={refetch} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{event.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{new Date(event.eventDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>
              {event.address ||
                (event.location &&
                typeof event.location === "object" &&
                "coordinates" in event.location
                  ? `Lat: ${event.location.coordinates[1]}, Lng: ${event.location.coordinates[0]}`
                  : "Location not specified")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{event.attendees} attendees</span>
          </div>
        </div>

        {event.maxAttendees && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Capacity</span>
              <span>
                {event.attendees} / {event.maxAttendees}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min((event.attendees / event.maxAttendees) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
