"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

interface UpcomingEventsChartProps {
  events: DashboardEvent[];
  className?: string;
}

export function UpcomingEventsChart({
  events,
  className,
}: UpcomingEventsChartProps) {
  // Filter out events without valid startDate
  const validEvents = events.filter(
    (event) => event.startDate && event.startDate.trim() !== "",
  );

  // Group events by day for the next 7 days
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split("T")[0];
  });

  const eventsByDay = next7Days.map((date) => {
    const dayEvents = validEvents.filter(
      (event) => event.startDate && event.startDate.startsWith(date),
    );

    return {
      date: new Date(date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      events: dayEvents.length,
      attendees: dayEvents.reduce(
        (sum, event) => sum + (event.attendees || 0),
        0,
      ),
    };
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upcoming Events (Next 7 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={eventsByDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={11}
            />
            <YAxis />
            <Tooltip
              formatter={(value, name) => [
                value,
                name === "events" ? "Events" : "Attendees",
              ]}
            />
            <Bar dataKey="events" fill="#3b82f6" name="Events" />
            <Bar dataKey="attendees" fill="#10b981" name="Attendees" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
