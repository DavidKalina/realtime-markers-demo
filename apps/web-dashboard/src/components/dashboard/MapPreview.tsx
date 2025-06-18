"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Calendar, Eye, EyeOff } from "lucide-react";
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

interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  isPrivate: boolean;
  emoji?: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  sharedWithIds: string[];
  locationNotes: string;
  image?: File;
}

interface SelectedLocation {
  name: string;
  address: string;
  coordinates: [number, number];
  placeId: string;
  locationNotes?: string;
}

interface MapPreviewProps {
  formData: EventFormData;
  selectedLocation: SelectedLocation | null;
  onLocationSelect: (location: SelectedLocation) => void;
  className?: string;
}

export function MapPreview({
  formData,
  selectedLocation,
  onLocationSelect,
  className = "",
}: MapPreviewProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 12,
    pitch: 0,
    bearing: 0,
  });
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );

  // Get user location on component mount
  useEffect(() => {
    const getUserLocation = () => {
      if (!navigator.geolocation) {
        console.log("Geolocation is not supported by this browser.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          setViewState((prev) => ({
            ...prev,
            longitude,
            latitude,
          }));
        },
        () => {
          console.log("Unable to get your location.");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        },
      );
    };

    getUserLocation();
  }, []);

  // Update map center when location is selected
  useEffect(() => {
    if (selectedLocation) {
      setViewState((prev) => ({
        ...prev,
        longitude: selectedLocation.coordinates[0],
        latitude: selectedLocation.coordinates[1],
        zoom: 15, // Zoom in closer for selected location
      }));
    }
  }, [selectedLocation]);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    (event: any) => {
      if (!event.lngLat) return;

      const { lng, lat } = event.lngLat;

      // Create a location object from the dragged coordinates
      const location: SelectedLocation = {
        name: "Selected Location",
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        coordinates: [lng, lat],
        placeId: `manual_${Date.now()}`,
      };

      onLocationSelect(location);
    },
    [onLocationSelect],
  );

  // Handle map click to select location
  const handleMapClick = useCallback(
    (event: any) => {
      if (!event.lngLat) return;

      const { lng, lat } = event.lngLat;

      // Create a location object from the clicked coordinates
      const location: SelectedLocation = {
        name: "Selected Location",
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        coordinates: [lng, lat],
        placeId: `manual_${Date.now()}`,
      };

      onLocationSelect(location);
    },
    [onLocationSelect],
  );

  // Handle viewport changes
  const handleViewportChange = (evt: { viewState: ViewState }) => {
    setViewState(evt.viewState);
  };

  // Create preview marker from form data
  const createPreviewMarker = (): Marker | null => {
    if (!selectedLocation) return null;

    return {
      id: "preview",
      data: {
        emoji: formData.emoji || "📍",
        title: formData.title || "Preview Event",
        eventDate:
          formData.date && formData.time
            ? `${formData.date}T${formData.time}`
            : undefined,
        isPrivate: formData.isPrivate,
      },
      coordinates: selectedLocation.coordinates,
    };
  };

  const previewMarker = createPreviewMarker();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Event Map Preview
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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Event Map Preview
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Click on the map or drag the marker to set a location for your event
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative h-80 rounded-lg overflow-hidden border">
            <Map
              ref={mapRef}
              {...viewState}
              onMove={handleViewportChange}
              onClick={handleMapClick}
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
              {/* User Location Marker */}
              {userLocation && (
                <MapboxMarker
                  longitude={userLocation[0]}
                  latitude={userLocation[1]}
                  anchor="center"
                >
                  <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
                </MapboxMarker>
              )}

              {/* Preview Marker */}
              {previewMarker && (
                <MapboxMarker
                  key={previewMarker.id}
                  longitude={previewMarker.coordinates[0]}
                  latitude={previewMarker.coordinates[1]}
                  anchor="bottom"
                  draggable={true}
                  onDragEnd={handleMarkerDragEnd}
                >
                  <div className="relative z-20">
                    <MapMojiMarker
                      event={previewMarker}
                      onPress={() => {
                        console.log("Preview marker clicked:", previewMarker);
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
                  🖱️ Click to set location • 🎯 Drag marker • 🔍 Zoom • 📍{" "}
                  {previewMarker ? "1 event" : "No location"}
                </p>
              </div>
            </div>
          </div>

          {/* Location Info */}
          {selectedLocation && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Selected Location
              </h3>
              <p className="text-gray-600 text-sm mt-1">
                {selectedLocation.name}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {selectedLocation.address}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">
                  {selectedLocation.coordinates[1].toFixed(6)},{" "}
                  {selectedLocation.coordinates[0].toFixed(6)}
                </Badge>
              </div>
            </div>
          )}

          {/* Event Preview Info */}
          {previewMarker && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {formData.isPrivate ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Event Preview
              </h3>
              <p className="text-gray-600 text-sm mt-1">
                {formData.title || "Untitled Event"}
              </p>
              {formData.description && (
                <p className="text-gray-500 text-xs mt-1">
                  {formData.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <Badge variant={formData.isPrivate ? "default" : "secondary"}>
                  {formData.isPrivate ? "Private" : "Public"}
                </Badge>
                {formData.date && formData.time && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    {new Date(
                      `${formData.date}T${formData.time}`,
                    ).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedLocation && (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Click on the map to select a location for your event</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
