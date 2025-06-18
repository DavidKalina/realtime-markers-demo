"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, MapPin, Users, Plus } from "lucide-react";
import Link from "next/link";

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
            <Link href="/events/create">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            </Link>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{event.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {event.date} at {event.time}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{event.attendees}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.status === "completed" ? "secondary" : "default"
                        }
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
