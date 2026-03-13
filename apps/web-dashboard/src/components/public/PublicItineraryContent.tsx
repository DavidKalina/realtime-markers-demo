"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, Loader2, MapPin } from "lucide-react";

interface ItineraryItem {
  id: string;
  sortOrder: number;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  emoji?: string;
  estimatedCost?: number;
  venueName?: string;
  venueAddress?: string;
  travelNote?: string;
  venueCategory?: string;
  whyThisStop?: string;
  proTip?: string;
  latitude?: number;
  longitude?: number;
}

interface Itinerary {
  id: string;
  city: string;
  plannedDate: string;
  durationHours: number;
  activityTypes: string[];
  title?: string;
  summary?: string;
  items: ItineraryItem[];
}

interface PublicItineraryContentProps {
  shareToken: string;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const ACCENT_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
  "#f9a8d4",
  "#67e8f9",
  "#fca5a5",
];

export function PublicItineraryContent({
  shareToken,
}: PublicItineraryContentProps) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    fetch(`${apiUrl}/api/public/itineraries/${shareToken}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setItinerary)
      .catch(() => setError("Itinerary not found"))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground font-space-mono">
            Loading itinerary...
          </span>
        </div>
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="text-6xl">🗺️</div>
          <h1 className="text-2xl font-bold">Itinerary Not Found</h1>
          <p className="text-muted-foreground">
            {error || "This itinerary may have been removed or doesn't exist."}
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

  const items = [...(itinerary.items || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const totalCost = items.reduce(
    (sum, i) => sum + (Number(i.estimatedCost) || 0),
    0,
  );

  // Build static map URL with all stops that have coordinates
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const geoItems = items.filter((i) => i.latitude && i.longitude);
  const staticMapUrl =
    mapboxToken && geoItems.length > 0
      ? (() => {
          const pins = geoItems
            .map(
              (item, idx) =>
                `pin-s-${idx + 1}+${ACCENT_COLORS[idx % ACCENT_COLORS.length].replace("#", "")}(${item.longitude},${item.latitude})`,
            )
            .join(",");
          // Auto-fit to bounds
          return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pins}/auto/600x300@2x?padding=50&access_token=${mapboxToken}`;
        })()
      : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">
          {itinerary.title || "Itinerary"}
        </h1>
        <p className="text-muted-foreground font-space-mono text-sm">
          {itinerary.city} · {formatDate(itinerary.plannedDate)}
        </p>
        {itinerary.activityTypes && itinerary.activityTypes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {itinerary.activityTypes.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {itinerary.summary && (
        <div className="bg-card rounded-xl border p-5 mb-4">
          <p className="text-muted-foreground leading-relaxed">
            {itinerary.summary}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-[#93c5fd]" />
          <div className="text-lg font-bold">{itinerary.durationHours}h</div>
          <div className="text-xs text-muted-foreground">Duration</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <MapPin className="h-5 w-5 mx-auto mb-1 text-[#86efac]" />
          <div className="text-lg font-bold">{items.length}</div>
          <div className="text-xs text-muted-foreground">Stops</div>
        </div>
        {totalCost > 0 && (
          <div className="bg-card rounded-xl border p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-[#c4b5fd]" />
            <div className="text-lg font-bold">~${totalCost}</div>
            <div className="text-xs text-muted-foreground">Est. Cost</div>
          </div>
        )}
      </div>

      {/* Map */}
      {staticMapUrl && (
        <div className="rounded-xl overflow-hidden border mb-6">
          <img
            src={staticMapUrl}
            alt="Itinerary map"
            className="w-full h-auto"
            loading="lazy"
          />
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-0">
        {items.map((item, idx) => {
          const color = ACCENT_COLORS[idx % ACCENT_COLORS.length];
          return (
            <div key={item.id}>
              {/* Travel note connector */}
              {item.travelNote && idx > 0 && (
                <div className="flex items-center gap-3 py-2 pl-[18px]">
                  <div
                    className="w-px h-6"
                    style={{ backgroundColor: `${color}30` }}
                  />
                  <span className="text-xs text-muted-foreground italic">
                    {item.travelNote}
                  </span>
                </div>
              )}

              {/* Stop card */}
              <div className="flex gap-4">
                {/* Timeline dot + rail */}
                <div className="flex flex-col items-center pt-1">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    {item.emoji || "📍"}
                  </div>
                  {idx < items.length - 1 && (
                    <div
                      className="w-px flex-1 mt-2"
                      style={{ backgroundColor: `${color}25` }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="bg-card rounded-xl border p-4 mb-3 flex-1">
                  {/* Time */}
                  <div
                    className="text-xs font-mono font-semibold mb-1"
                    style={{ color }}
                  >
                    {formatTime(item.startTime)} – {formatTime(item.endTime)}
                  </div>

                  <h3 className="font-bold text-base mb-1">{item.title}</h3>

                  {item.description && (
                    <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {/* Venue info */}
                  {item.venueName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>
                        {item.venueName}
                        {item.venueAddress && ` — ${item.venueAddress}`}
                      </span>
                    </div>
                  )}

                  {/* Cost */}
                  {item.estimatedCost != null && item.estimatedCost > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <DollarSign className="h-3 w-3 shrink-0" />
                      <span>~${item.estimatedCost}</span>
                    </div>
                  )}

                  {/* Why this stop */}
                  {item.whyThisStop && (
                    <div
                      className="text-xs rounded-lg px-3 py-2 mb-2"
                      style={{
                        backgroundColor: `${color}10`,
                        borderLeft: `2px solid ${color}40`,
                      }}
                    >
                      {item.whyThisStop}
                    </div>
                  )}

                  {/* Pro tip */}
                  {item.proTip && (
                    <div className="text-xs rounded-lg px-3 py-2 bg-yellow-500/5 border-l-2 border-yellow-500/30 text-yellow-200/80">
                      💡 {item.proTip}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="text-center space-y-4 py-8 mt-4 border-t">
        <h3 className="text-xl font-bold">Plan your own itinerary</h3>
        <p className="text-muted-foreground text-sm">
          Download A Third Space to create AI-powered itineraries for any city
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Explore Events
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Powered by A Third Space
        </p>
      </div>
    </div>
  );
}
