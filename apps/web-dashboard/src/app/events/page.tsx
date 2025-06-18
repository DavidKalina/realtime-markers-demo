"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users } from "lucide-react";

export default function EventsPage() {
  // Mock data - replace with real data from your API
  const events = [
    {
      id: 1,
      title: "Tech Meetup",
      description: "Join us for an evening of networking and tech talks",
      date: "2024-01-15",
      time: "18:00",
      location: "Downtown Conference Center",
      attendees: 45,
      category: "Technology",
      status: "upcoming",
    },
    {
      id: 2,
      title: "Art Exhibition",
      description: "Local artists showcase their latest works",
      date: "2024-01-20",
      time: "14:00",
      location: "City Art Gallery",
      attendees: 23,
      category: "Arts",
      status: "upcoming",
    },
    {
      id: 3,
      title: "Food Festival",
      description: "Taste the best local cuisine",
      date: "2024-01-10",
      time: "12:00",
      location: "Central Park",
      attendees: 120,
      category: "Food",
      status: "completed",
    },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Events</h2>
              <p className="text-muted-foreground">
                Manage and view all events
              </p>
            </div>
            <Button>Create Event</Button>
          </div>

          <div className="grid gap-6">
            {events.map((event) => (
              <Card
                key={event.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{event.title}</CardTitle>
                      <p className="text-muted-foreground mt-1">
                        {event.description}
                      </p>
                    </div>
                    <Badge
                      variant={
                        event.status === "completed" ? "secondary" : "default"
                      }
                    >
                      {event.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {event.date} at {event.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{event.attendees} attendees</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Badge variant="outline">{event.category}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
