"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
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

// Dynamic import for MapMojiMarker to reduce initial bundle size
const MapMojiMarker = dynamic(
  () =>
    import("./MapMojiMarker").then((mod) => ({ default: mod.MapMojiMarker })),
  {
    loading: () => (
      <div className="w-12 h-12 bg-gray-300 rounded-full animate-pulse flex items-center justify-center">
        <div className="text-gray-500 text-xs">...</div>
      </div>
    ),
  },
);

// Import types and components
import type { ViewState, MapRef } from "react-map-gl/mapbox";
import { Marker as MapboxMarker } from "react-map-gl/mapbox";
import type { Marker } from "./MapMojiMarker";
import { useMapWebSocket } from "@/hooks/useMapWebsocketWeb";
import ConnectionIndicator from "./ConnectionIndicator";

interface InteractiveMapProps {
  websocketUrl: string;
  className?: string;
  initialCenter: [number, number];
  initialZoom: number;
}

export const InteractiveMap = ({
  websocketUrl,
  className,
  initialCenter,
  initialZoom,
}: InteractiveMapProps) => {
  const mapRef = useRef<MapRef>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [isMapReady, setIsMapReady] = useState(false);

  // Use the websocket hook
  const { markers, isConnected, error, updateViewport } =
    useMapWebSocket(websocketUrl);

  const [viewState, setViewState] = useState({
    longitude: initialCenter[0],
    latitude: initialCenter[1],
    zoom: initialZoom,
    pitch: 0,
    bearing: 0,
  });

  // Get user location on component mount
  useEffect(() => {
    const getUserLocation = () => {
      if (!navigator.geolocation) {
        console.log(
          "Geolocation is not supported by this browser. Using default location.",
        );
        // Fallback to initial center
        setUserLocation(initialCenter);
        setViewState((prev) => ({
          ...prev,
          longitude: initialCenter[0],
          latitude: initialCenter[1],
        }));
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
          console.log("Unable to get your location. Using default location.");
          // Fallback to initial center
          setUserLocation(initialCenter);
          setViewState((prev) => ({
            ...prev,
            longitude: initialCenter[0],
            latitude: initialCenter[1],
          }));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        },
      );
    };

    getUserLocation();
  }, [initialCenter]);

  // Handle viewport changes and send to websocket
  const handleViewportChange = (evt: { viewState: ViewState }) => {
    const newViewState = evt.viewState;
    setViewState(newViewState);

    // Convert to Mapbox viewport format and send to websocket
    if (mapRef.current && isMapReady) {
      const map = mapRef.current.getMap();
      const bounds = map.getBounds();

      if (bounds) {
        const viewport = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        };

        updateViewport(viewport);
      }
    }
  };

  // Handle marker press
  const handleMarkerPress = (marker: Marker) => {
    console.log("Marker pressed:", marker);
    // Add your marker interaction logic here
  };

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <section className="relative w-full h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md w-full shadow-sm mx-4">
          <div className="text-center">
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
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`relative w-full h-96 overflow-hidden ${className}`}>
      {/* Connection indicator */}
      <div className="absolute top-4 right-4 z-50">
        <ConnectionIndicator />
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute top-4 left-4 z-50">
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-200 font-space-mono text-sm">
              ⚠️ Connection error: {error.message}
            </p>
          </div>
        </div>
      )}

      {/* Full-screen Mapbox map */}
      <Suspense
        fallback={
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg text-gray-600 font-space-mono">
                Loading map...
              </div>
            </div>
          </div>
        }
      >
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
          {/* User Location Marker (for debugging) */}
          {userLocation && (
            <MapboxMarker
              longitude={userLocation[0]}
              latitude={userLocation[1]}
              anchor="center"
            >
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
            </MapboxMarker>
          )}

          {/* MapMoji Markers from websocket */}
          {markers.map((marker) => (
            <MapboxMarker
              key={marker.id}
              longitude={marker.coordinates[0]}
              latitude={marker.coordinates[1]}
              anchor="bottom"
            >
              <div className="relative z-20">
                <Suspense
                  fallback={
                    <div className="w-12 h-12 bg-gray-300 rounded-full animate-pulse"></div>
                  }
                >
                  <MapMojiMarker
                    event={marker}
                    onPress={() => handleMarkerPress(marker)}
                  />
                </Suspense>
              </div>
            </MapboxMarker>
          ))}
        </Map>
      </Suspense>

      {/* Loading overlay */}
      {!isMapReady && (
        <div className="absolute inset-0 z-50 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg text-gray-600 font-space-mono">
              Loading map...
            </div>
          </div>
        </div>
      )}

      {/* Map controls info */}
      <div className="absolute bottom-4 left-4 z-40">
        <div className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg p-3">
          <p className="text-white font-space-mono text-sm">
            🖱️ Pan • 🔍 Zoom • 📍 {markers.length} events
          </p>
        </div>
      </div>
    </section>
  );
};
