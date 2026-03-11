"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { ViewState } from "react-map-gl/mapbox";
import { Marker as MapboxMarker, Source, Layer } from "react-map-gl/mapbox";
import type { ItineraryItemFormData } from "./CreateItineraryForm";

const Map = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => ({ default: mod.default })),
  {
    loading: () => (
      <div className="w-full h-full bg-secondary flex items-center justify-center">
        <div className="text-lg text-muted-foreground font-space-mono">
          Loading map...
        </div>
      </div>
    ),
  },
);

interface ItineraryMapPreviewProps {
  items: ItineraryItemFormData[];
  selectedItemIndex: number | null;
  debugCenter: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  className?: string;
}

const CHECK_IN_RADIUS_KM = 0.075; // 75 meters

function createCircleGeoJSON(
  lat: number,
  lng: number,
  radiusKm: number,
  steps = 64,
): GeoJSON.Feature {
  const coords: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const dLat = (radiusKm / 111.32) * Math.cos(angle);
    const dLng =
      (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([lng + dLng, lat + dLat]);
  }
  coords.push(coords[0]); // close the ring
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

const circleFillStyle = {
  id: "check-in-radius-fill",
  type: "fill",
  paint: {
    "fill-color": "#3b82f6",
    "fill-opacity": 0.12,
  },
};

export function ItineraryMapPreview({
  items,
  selectedItemIndex,
  debugCenter,
  onMapClick,
  className = "",
}: ItineraryMapPreviewProps) {
  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 14,
    pitch: 0,
    bearing: 0,
  });

  const handleMapClick = useCallback(
    (event: any) => {
      if (!event.lngLat) return;
      onMapClick(event.lngLat.lat, event.lngLat.lng);
    },
    [onMapClick],
  );

  const handleViewportChange = (evt: { viewState: ViewState }) => {
    setViewState(evt.viewState);
  };

  // Build GeoJSON for all check-in radius circles
  const circlesGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: items
      .filter((item) => item.latitude && item.longitude)
      .map((item) =>
        createCircleGeoJSON(
          item.latitude!,
          item.longitude!,
          CHECK_IN_RADIUS_KM,
        ),
      ),
  };

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Itinerary Map Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-space-mono text-sm">
              Mapbox token not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN to
              .env.local
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
          Itinerary Map Preview
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Click the map to set coordinates for the selected item. Blue circles
          show 75m check-in zones.
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative h-[500px] rounded-lg overflow-hidden border">
          <Map
            {...viewState}
            onMove={handleViewportChange}
            onClick={handleMapClick}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={mapboxToken}
            attributionControl={false}
            interactive={true}
          >
            {/* Check-in radius circles */}
            {circlesGeoJSON.features.length > 0 && (
              <Source
                id="check-in-circles"
                type="geojson"
                data={circlesGeoJSON}
              >
                <Layer {...circleFillStyle} />
              </Source>
            )}

            {/* Item markers */}
            {items.map((item, index) => {
              if (!item.latitude || !item.longitude) return null;
              const isSelected = selectedItemIndex === index;
              return (
                <MapboxMarker
                  key={index}
                  longitude={item.longitude}
                  latitude={item.latitude}
                  anchor="center"
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold border-2 ${
                      isSelected
                        ? "bg-blue-500 border-white scale-125"
                        : "bg-zinc-700 border-zinc-500"
                    } transition-transform`}
                  >
                    {item.emoji || index + 1}
                  </div>
                </MapboxMarker>
              );
            })}

            {/* Debug center marker */}
            {debugCenter && (
              <MapboxMarker
                longitude={debugCenter.lng}
                latitude={debugCenter.lat}
                anchor="center"
              >
                <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg" />
              </MapboxMarker>
            )}
          </Map>

          <div className="absolute bottom-2 left-2 z-40">
            <div className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg p-2">
              <p className="text-white font-space-mono text-xs">
                Click to set coords
                {selectedItemIndex !== null
                  ? ` for item #${selectedItemIndex + 1}`
                  : " (select an item first)"}
                {" | "}
                {items.filter((i) => i.latitude && i.longitude).length}/
                {items.length} placed
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
