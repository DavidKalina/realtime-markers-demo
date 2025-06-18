"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import "mapbox-gl/dist/mapbox-gl.css";

// Dynamic import for Map component to reduce initial bundle size
const Map = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => ({ default: mod.default })),
  {
    loading: () => (
      <div className="w-full h-full bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl md:text-6xl font-bold text-white font-space-mono mb-4 animate-pulse">
            MapMoji
          </div>
          <p className="text-lg md:text-xl text-gray-300 font-space-mono">
            Loading your world...
          </p>
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

// Custom hook for camera animation around user location
const useCameraAnimation = (
  mapRef: React.RefObject<MapRef | null>,
  userLocation: [number, number] | null,
  radiusMiles: number = 5,
) => {
  const animationRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);

  const startAnimation = React.useCallback(() => {
    if (!mapRef.current || !userLocation) return;

    const map = mapRef.current.getMap();
    if (!map || isAnimatingRef.current) return;

    // Set the map center to user location
    map.setCenter(userLocation);

    // Set appropriate zoom and pitch for the radius
    const zoomLevel = Math.max(12, 16 - Math.log2(radiusMiles));
    map.setZoom(zoomLevel);
    map.setPitch(45);

    isAnimatingRef.current = true;

    const rotateCamera = (timestamp: number) => {
      if (!isAnimatingRef.current) return;
      map.rotateTo((timestamp / 600) % 360, { duration: 0 });
      animationRef.current = requestAnimationFrame(rotateCamera);
    };

    animationRef.current = requestAnimationFrame(rotateCamera);
  }, [userLocation, radiusMiles]);

  const stopAnimation = React.useCallback(() => {
    isAnimatingRef.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
  }, []);

  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  return { startAnimation, stopAnimation };
};

// Error boundary component for map errors
class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Map error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="relative w-full h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
          <div className="bg-black/80 backdrop-blur-sm border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl mx-4">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-white font-space-mono mb-2">
                MapMoji
              </h1>
              <p className="text-gray-300 font-space-mono text-sm mb-4">
                A Third Space in Your Pocket
              </p>
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-200 font-space-mono text-sm">
                  ⚠️ Map failed to load. Please refresh the page or check your
                  connection.
                </p>
              </div>
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

const radiusMiles = 5;

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
  const [isMapFullyLoaded, setIsMapFullyLoaded] = useState(false);
  const [isLoadingFadingOut, setIsLoadingFadingOut] = useState(false);
  const [allMarkers, setAllMarkers] = useState<Marker[]>([]);
  const [visibleMarkers, setVisibleMarkers] = useState<Set<string>>(new Set());

  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 13,
    pitch: 65,
    bearing: -180,
  });

  const { startAnimation } = useCameraAnimation(
    mapRef,
    userLocation,
    radiusMiles,
  );

  // Generate random markers within current map bounds
  const generateMarkersInBounds = (): Marker[] => {
    const markers: Marker[] = [];
    const emojis = [
      "🍕",
      "🎵",
      "☕",
      "🎨",
      "🏃",
      "📚",
      "🎭",
      "🍺",
      "🎮",
      "🎪",
      "🏖️",
      "🎯",
      "🎲",
      "🎸",
      "🎤",
      "🎬",
    ];
    const titles = [
      "Pizza Night",
      "Music Session",
      "Coffee Meetup",
      "Art Workshop",
      "Running Club",
      "Book Club",
      "Theater Night",
      "Pub Crawl",
      "Gaming Night",
      "Circus Show",
      "Beach Day",
      "Dart Tournament",
      "Board Games",
      "Live Music",
      "Karaoke Night",
      "Movie Night",
    ];

    if (!userLocation) {
      console.log("User location not available");
      return markers;
    }

    // Define the radius in degrees (approximately 0.01 degrees ≈ 1km)
    const circleRadiusDegrees = 0.1; // About 10km radius

    console.log("Generating markers within circle:", {
      center: userLocation,
      radius: circleRadiusDegrees,
    });

    // Generate 12 markers randomly within the circle
    for (let i = 0; i < 12; i++) {
      // Generate random angle and radius within the circle
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.sqrt(Math.random()) * circleRadiusDegrees; // Square root for uniform distribution

      // Calculate position relative to user location
      const lng = userLocation[0] + radius * Math.cos(angle);
      const lat = userLocation[1] + radius * Math.sin(angle);

      console.log(`Marker ${i} coordinates:`, [lng, lat]);

      markers.push({
        id: `marker-${i}`,
        data: {
          emoji: emojis[i % emojis.length], // Use modulo to cycle through emojis
          title: titles[i % titles.length], // Use modulo to cycle through titles
          eventDate: new Date(
            Date.now() + (i + 1) * 60 * 60 * 1000,
          ).toISOString(),
          endDate: new Date(
            Date.now() + (i + 3) * 60 * 60 * 1000,
          ).toISOString(),
          isPrivate: Math.random() > 0.7,
        },
        coordinates: [lng, lat] as [number, number],
      });
    }

    return markers;
  };

  // Simulate markers dropping onto the map
  useEffect(() => {
    if (isMapReady && userLocation) {
      const dropMarkers = () => {
        console.log("Generating markers...");
        const markers = generateMarkersInBounds();
        console.log("Generated markers:", markers);

        // Set all markers first
        setAllMarkers(markers);

        // Start with no visible markers
        setVisibleMarkers(new Set());

        // Stagger the appearance of markers
        markers.forEach((marker, index) => {
          // Base delay: 1 second initial + 2 seconds between each marker
          const baseDelay = index * 2000 + 1000;
          // Add random delay between 0-3 seconds
          const randomDelay = Math.random() * 3000;
          const totalDelay = baseDelay + randomDelay;

          setTimeout(() => {
            setVisibleMarkers((prev) => new Set([...prev, marker.id]));
            console.log(`Added marker ${index}:`, marker);
          }, totalDelay);
        });
      };

      // Add a longer delay to ensure map is fully loaded
      const timer = setTimeout(dropMarkers, 3000);
      return () => clearTimeout(timer);
    }
  }, [isMapReady, userLocation]);

  // Handle marker press
  const handleMarkerPress = (marker: Marker) => {
    console.log("Marker pressed:", marker);
    // Add your marker interaction logic here
  };

  // Get user location on component mount
  useEffect(() => {
    const getUserLocation = () => {
      if (!navigator.geolocation) {
        console.log(
          "Geolocation is not supported by this browser. Using default location.",
        );
        // Fallback to New York City coordinates
        const fallbackLocation: [number, number] = [-74.006, 40.7128];
        setUserLocation(fallbackLocation);
        setViewState((prev) => ({
          ...prev,
          longitude: fallbackLocation[0],
          latitude: fallbackLocation[1],
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
          // Fallback to New York City coordinates
          const fallbackLocation: [number, number] = [-74.006, 40.7128];
          setUserLocation(fallbackLocation);
          setViewState((prev) => ({
            ...prev,
            longitude: fallbackLocation[0],
            latitude: fallbackLocation[1],
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
  }, []);

  useEffect(() => {
    if (isMapReady && userLocation) {
      const timer = setTimeout(() => {
        startAnimation();
        // Start fade-out animation
        setIsLoadingFadingOut(true);
        // Set map as fully loaded after fade-out completes
        setTimeout(() => {
          setIsMapFullyLoaded(true);
        }, 1000); // Match the CSS transition duration
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isMapReady, userLocation, startAnimation]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <section className="relative w-full h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-black/80 backdrop-blur-sm border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl mx-4">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white font-space-mono mb-2">
              MapMoji
            </h1>
            <p className="text-gray-300 font-space-mono text-sm mb-4">
              A Third Space in Your Pocket
            </p>
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-200 font-space-mono text-sm">
                ⚠️ Mapbox token not configured. Please add your Mapbox access
                token to{" "}
                <code className="bg-black/30 px-2 py-1 rounded">
                  .env.local
                </code>{" "}
                as{" "}
                <code className="bg-black/30 px-2 py-1 rounded">
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
    <MapErrorBoundary>
      <section className="relative w-full h-screen overflow-hidden">
        {/* Full-screen Mapbox map with 3D pitch and camera animation */}
        <Suspense
          fallback={
            <div className="w-full h-full bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl md:text-6xl font-bold text-white font-space-mono mb-4 animate-pulse">
                  MapMoji
                </div>
                <p className="text-lg md:text-xl text-gray-300 font-space-mono">
                  Loading your world...
                </p>
              </div>
            </div>
          }
        >
          <Map
            ref={mapRef}
            {...viewState}
            onMove={(evt: { viewState: ViewState }) =>
              setViewState(evt.viewState)
            }
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/outdoors-v12"
            mapboxAccessToken={mapboxToken}
            attributionControl={false}
            pitchWithRotate={true}
            dragRotate={true}
            interactive={false}
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

            {/* MapMoji Markers */}
            {allMarkers.map((marker, index) => {
              const isVisible = visibleMarkers.has(marker.id);
              if (!isVisible) return null;

              console.log(`Rendering marker ${index}:`, marker);
              return (
                <MapboxMarker
                  key={marker.id}
                  longitude={marker.coordinates[0]}
                  latitude={marker.coordinates[1]}
                  anchor="bottom"
                >
                  <div
                    className="animate-dropInWithShadow relative z-20"
                    style={{
                      animationDelay: "0s", // No delay since we control timing with visibility
                      animationFillMode: "both",
                    }}
                  >
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
              );
            })}
          </Map>
        </Suspense>

        {/* Animated gradient loading state */}
        {!isMapFullyLoaded && (
          <div
            className={`absolute inset-0 z-50 transition-all duration-1000 ease-in-out ${isLoadingFadingOut ? "opacity-0" : "opacity-100"}`}
          >
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 via-blue-800 via-gray-600 to-blue-900 animate-gradient-x"></div>

            {/* Animated gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent animate-shimmer"></div>

            {/* Loading content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="mb-6">
                  <div className="text-6xl md:text-8xl font-bold text-white font-space-mono mb-4 animate-pulse">
                    MapMoji
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dim overlay for better text readability */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] z-10"></div>

        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 via-blue-900/20 to-gray-800/20 animate-pulse-slow z-10"></div>

        {/* Hero content */}
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center">
            <h1 className="text-6xl md:text-8xl font-bold text-white font-space-mono mb-4">
              MapMoji
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 font-space-mono mb-8">
              A Third Space in Your Pocket
            </p>

            <div className="mt-8">
              <p className="text-blue-300 font-space-mono text-lg">
                📷 Scan • 🏷️ Save • 📤 Share
              </p>
            </div>
          </div>
        </div>
      </section>
    </MapErrorBoundary>
  );
};
