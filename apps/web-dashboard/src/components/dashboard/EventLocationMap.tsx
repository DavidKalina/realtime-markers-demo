"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users } from "lucide-react";
import dynamic from "next/dynamic";
import "mapbox-gl/dist/mapbox-gl.css";

// Dynamic import for Map component to reduce initial bundle size
const Map = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => ({ default: mod.default })),
  {
    loading: () => (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-gray-600 font-space-mono">
            Loading map...
          </div>
        </div>
      </div>
    ),
  },
);

// Dynamic import for MapMojiMarker
const MapMojiMarker = dynamic(
  () =>
    import("../map/MapMojiMarker").then((mod) => ({
      default: mod.MapMojiMarker,
    })),
  {
    loading: () => (
      <div className="w-12 h-12 bg-gray-300 rounded-full animate-pulse flex items-center justify-center">
        <div className="text-gray-500 text-xs">...</div>
      </div>
    ),
  },
);

import type { ViewState, MapRef } from "react-map-gl/mapbox";
import { Marker as MapboxMarker } from "react-map-gl/mapbox";
import type { Marker } from "../map/MapMojiMarker";
import type { Event } from "@/lib/dashboard-data";

interface EventLocationMapProps {
  event: Event;
  className?: string;
}

export function EventLocationMap({
  event,
  className = "",
}: EventLocationMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 12,
    pitch: 0,
    bearing: 0,
  });
  const [isMapReady, setIsMapReady] = useState(false);

  // Set map center to event location when component mounts or event changes
  useEffect(() => {
    if (event.location && event.location.coordinates) {
      const [longitude, latitude] = event.location.coordinates;
      setViewState((prev) => ({
        ...prev,
        longitude,
        latitude,
        zoom: 15, // Zoom in closer for event location
      }));
    }
  }, [event.location]);

  // Handle viewport changes
  const handleViewportChange = (evt: { viewState: ViewState }) => {
    setViewState(evt.viewState);
  };

  // Create event marker
  const createEventMarker = (): Marker | null => {
    if (!event.location || !event.location.coordinates) return null;

    return {
      id: event.id,
      data: {
        emoji: "📍", // Default emoji, could be enhanced to use event category emoji
        title: event.title,
        eventDate: event.eventDate,
        isPrivate: false, // We'll show this as public since it's in the dashboard
      },
      coordinates: event.location.coordinates,
    };
  };

  const eventMarker = createEventMarker();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Event Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-space-mono text-sm">
              ⚠️ Mapbox token not configured. Please add your Mapbox access
              token to{" "}
              <code className="bg-yellow-100 px-2 py-1 rounded">
                .env.local
              </code>{" "}
              as{" "}
              <code className="bg-yellow-100 px-2 py-1 rounded">
                NEXT_PUBLIC_MAPBOX_TOKEN
              </code>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!event.location || !event.location.coordinates) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Event Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No location data available for this event</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Event Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative h-80 rounded-lg overflow-hidden border">
            <Map
              ref={mapRef}
              {...viewState}
              onMove={handleViewportChange}
              style={{ width: "100%", height: "100%" }}
              mapStyle="mapbox://styles/mapbox/outdoors-v12"
              mapboxAccessToken={mapboxToken}
              attributionControl={false}
              pitchWithRotate={true}
              dragRotate={true}
              interactive={true}
              onLoad={() => {
                setIsMapReady(true);
              }}
              onError={(error) => {
                console.error("Map error:", error);
              }}
            >
              {/* Event Marker */}
              {eventMarker && (
                <MapboxMarker
                  key={eventMarker.id}
                  longitude={eventMarker.coordinates[0]}
                  latitude={eventMarker.coordinates[1]}
                  anchor="bottom"
                >
                  <div className="relative z-20">
                    <MapMojiMarker
                      event={eventMarker}
                      onPress={() => {
                        console.log("Event marker clicked:", eventMarker);
                      }}
                    />
                  </div>
                </MapboxMarker>
              )}
            </Map>

            {/* Map controls info */}
            <div className="absolute bottom-2 left-2 z-40">
              <div className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg p-2">
                <p className="text-white font-space-mono text-xs">
                  📍 Event location • 🔍 Zoom • 🖱️ Pan
                </p>
              </div>
            </div>
          </div>

          {/* Location Info */}
          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Event Location
            </h3>
            {event.address && (
              <p className="text-gray-600 text-sm mt-1">{event.address}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">
                {event.location.coordinates[1].toFixed(6)},{" "}
                {event.location.coordinates[0].toFixed(6)}
              </Badge>
            </div>
          </div>

          {/* Event Info */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-lg">{event.title}</h3>
            <p className="text-gray-600 text-sm mt-1">{event.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                {new Date(event.eventDate).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                {event.attendees} attendees
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
