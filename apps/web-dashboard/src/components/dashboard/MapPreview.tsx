"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Calendar } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: string;
  attendees: number;
  startTime: string;
  endTime: string;
}

interface MapPreviewProps {
  events?: Event[];
  className?: string;
}

export function MapPreview({ events = [], className = "" }: MapPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mapboxgl, setMapboxgl] = useState<any>(null);

  // Dynamically import mapbox-gl
  useEffect(() => {
    const loadMapbox = async () => {
      try {
        const mapboxModule = await import("mapbox-gl");
        const mapbox = mapboxModule.default;
        setMapboxgl(mapbox);

        // Set access token
        mapbox.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
      } catch (error) {
        console.error("Failed to load Mapbox:", error);
      }
    };

    loadMapbox();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxgl) return;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.006, 40.7128], // Default to NYC, you might want to center on your data
      zoom: 12,
    });

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxgl]);

  useEffect(() => {
    if (!map.current || !mapLoaded || !mapboxgl) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll(".mapbox-marker");
    existingMarkers.forEach((marker) => marker.remove());

    // Add markers for each event
    events.forEach((event) => {
      // Create marker element
      const markerEl = document.createElement("div");
      markerEl.className = "mapbox-marker";
      markerEl.style.width = "20px";
      markerEl.style.height = "20px";
      markerEl.style.borderRadius = "50%";
      markerEl.style.backgroundColor = "#3b82f6";
      markerEl.style.border = "2px solid white";
      markerEl.style.cursor = "pointer";
      markerEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <h3 class="font-semibold text-sm">${event.title}</h3>
          <p class="text-xs text-gray-600 mt-1">${event.description}</p>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${event.category}</span>
            <span class="text-xs text-gray-500">${event.attendees} attending</span>
          </div>
        </div>
      `);

      // Add marker to map
      new mapboxgl.Marker(markerEl)
        .setLngLat([event.longitude, event.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      // Add click handler
      markerEl.addEventListener("click", () => {
        setSelectedEvent(event);
      });
    });

    // Fit map to show all markers if there are events
    if (events.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      events.forEach((event) => {
        bounds.extend([event.longitude, event.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [events, mapLoaded, mapboxgl]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Event Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div
            ref={mapContainer}
            className="w-full h-64 rounded-lg overflow-hidden border"
          />

          {selectedEvent && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold text-lg">{selectedEvent.title}</h3>
              <p className="text-gray-600 text-sm mt-1">
                {selectedEvent.description}
              </p>

              <div className="flex items-center gap-4 mt-3">
                <Badge variant="secondary">{selectedEvent.category}</Badge>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  {selectedEvent.attendees}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  {new Date(selectedEvent.startTime).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No events to display on map</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
