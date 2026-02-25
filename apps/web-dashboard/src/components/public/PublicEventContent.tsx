"use client";

import { Badge } from "@/components/ui/badge";
import { usePublicEvent } from "@/hooks/usePublicEvent";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Eye,
  Heart,
  Loader2,
  MapPin,
  Repeat,
  Scan,
} from "lucide-react";

interface PublicEventContentProps {
  eventId: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PublicEventContent({ eventId }: PublicEventContentProps) {
  const { event, loading, error } = usePublicEvent(eventId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground font-space-mono">
            Loading event...
          </span>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="text-6xl">🔍</div>
          <h1 className="text-2xl font-bold">Event Not Found</h1>
          <p className="text-muted-foreground">
            {error || "This event may have been removed or doesn't exist."}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Discover Events
          </Link>
        </div>
      </div>
    );
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const hasCoordinates = event.location?.coordinates;
  const staticMapUrl =
    mapboxToken && hasCoordinates
      ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+93c5fd(${event.location.coordinates[0]},${event.location.coordinates[1]})/${event.location.coordinates[0]},${event.location.coordinates[1]},14,0/600x300@2x?access_token=${mapboxToken}`
      : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center mb-8">
        <div className="text-7xl mb-4">{event.emoji || "📍"}</div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">{event.title}</h1>
        {event.categories && event.categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {event.categories.map((cat: any) => (
              <Badge key={cat.id} variant="secondary" className="text-sm">
                {cat.emoji} {cat.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Date/Time */}
      <div className="bg-card rounded-xl border p-5 mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary shrink-0" />
          <div>
            <div className="font-medium">{formatDate(event.eventDate)}</div>
            {event.endDate && (
              <div className="text-sm text-muted-foreground">
                to {formatDate(event.endDate)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary shrink-0" />
          <span>{formatTime(event.eventDate)}</span>
        </div>
      </div>

      {/* Location */}
      {(event.address || hasCoordinates) && (
        <div className="bg-card rounded-xl border p-5 mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <span>{event.address || "View on map"}</span>
          </div>
          {staticMapUrl && (
            <div className="rounded-lg overflow-hidden border mt-2">
              <img
                src={staticMapUrl}
                alt="Event location map"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div className="bg-card rounded-xl border p-5 mb-4">
          <h2 className="font-semibold mb-2">About</h2>
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {event.description}
          </p>
        </div>
      )}

      {/* Engagement Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <Eye className="h-5 w-5 mx-auto mb-1 text-primary" />
          <div className="text-lg font-bold">{event.viewCount || 0}</div>
          <div className="text-xs text-muted-foreground">Views</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <Heart className="h-5 w-5 mx-auto mb-1 text-red-400" />
          <div className="text-lg font-bold">{event.saveCount || 0}</div>
          <div className="text-xs text-muted-foreground">Saves</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <Scan className="h-5 w-5 mx-auto mb-1 text-app-success" />
          <div className="text-lg font-bold">{event.scanCount || 0}</div>
          <div className="text-xs text-muted-foreground">Scans</div>
        </div>
      </div>

      {/* Recurring Info */}
      {event.isRecurring && (
        <div className="bg-card rounded-xl border p-5 mb-4">
          <div className="flex items-center gap-3">
            <Repeat className="h-5 w-5 text-primary shrink-0" />
            <div>
              <div className="font-medium">Recurring Event</div>
              <div className="text-sm text-muted-foreground">
                {event.recurrenceFrequency &&
                  `Repeats ${event.recurrenceFrequency.toLowerCase()}`}
                {event.recurrenceEndDate &&
                  ` until ${formatDate(event.recurrenceEndDate)}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creator */}
      {event.creator && (
        <div className="bg-card rounded-xl border p-5 mb-8">
          <div className="flex items-center gap-3">
            {event.creator.avatarUrl ? (
              <img
                src={event.creator.avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {event.creator.firstName?.charAt(0) || "?"}
              </div>
            )}
            <div>
              <div className="font-medium">
                {event.creator.firstName || "Anonymous"}
              </div>
              {event.creator.currentTier && (
                <div className="text-xs text-muted-foreground">
                  {event.creator.currentTier}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center space-y-4 py-8 border-t">
        <h3 className="text-xl font-bold">Discover more events</h3>
        <p className="text-muted-foreground text-sm">
          Download Mapmoji to discover events happening around you
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Explore Events
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-6">Powered by Mapmoji</p>
      </div>
    </div>
  );
}
