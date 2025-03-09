import { AuthWrapper } from "@/components/AuthWrapper";
import { ConnectionIndicator } from "@/components/ConnectionIndicator/ConnectionIndicator";
import EventAssistant from "@/components/EventAssistant/EventAssistant";
import { styles } from "@/components/homeScreenStyles";
import { ClusteredMapMarkers } from "@/components/Markers/MarkerImplementation";
import QueueIndicator from "@/components/QueueIndicator/QueueIndicator";
import { useUserLocation } from "@/contexts/LocationContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useGravitationalCamera } from "@/hooks/useGravitationalCamera";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { BaseEvent, EventTypes, MapItemEvent } from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Text, TouchableOpacity, View } from "react-native";

// Import for a simple filter UI (you may want to create a separate component)
import { FilterIcon } from "lucide-react-native";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

// Simple filter options for testing
const FILTER_OPTIONS = [
  { name: "Food", categories: ["food", "restaurant", "cafe"], tags: ["food"] },
  {
    name: "Entertainment",
    categories: ["entertainment", "arts", "social event"],
    tags: ["entertainment", "arts"],
  },
  { name: "Shopping", categories: ["shopping", "retail"], tags: ["shopping"] },
  { name: "Outdoors", categories: ["outdoors", "parks"], tags: ["outdoors", "nature"] },
];

export default function HomeScreen() {
  const [isMapReady, setIsMapReady] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const mapRef = useRef<MapboxGL.MapView>(null);
  const { publish } = useEventBroker();

  // Use the selectMapItem from the updated store
  const { selectMapItem } = useLocationStore();

  // We can keep references to these for backward compatibility
  const selectedItem = useLocationStore((state) => state.selectedItem);

  const { userLocation, locationPermissionGranted, isLoadingLocation, getUserLocation } =
    useUserLocation();

  const mapWebSocketData = useMapWebSocket(process.env.EXPO_PUBLIC_WEB_SOCKET_URL!);
  const {
    markers,
    isConnected,
    updateViewport,
    currentViewport,
    // New filter functions
    createSubscription,
    updateSubscription,
    deleteSubscription,
    listSubscriptions,
    subscriptions,
  } = mapWebSocketData;

  const {
    cameraRef,
    isGravitating,
    handleViewportChange: handleGravitationalViewportChange,
  } = useGravitationalCamera(markers, {
    minMarkersForPull: 1,
    animationDuration: 500,
    cooldownPeriod: 2000, // Higher cooldown period
    gravityZoomLevel: 14,
    centeringThreshold: 0.003, // Slightly higher threshold
    velocitySampleSize: 3, // Reduced sample size
    velocityMeasurementWindow: 200, // Shorter measurement window
  });

  useEffect(() => {
    // Setup code for MapboxGL
    if (Platform.OS === "android") {
      MapboxGL.setTelemetryEnabled(false);
    }

    // Get user location if needed
    if (!userLocation) {
      getUserLocation();
    }

    // Return cleanup function
    return () => {
      // Clean up any MapboxGL resources
      if (mapRef.current) {
        // MapboxGL cleanup if needed
      }
      if (cameraRef.current) {
        // Camera cleanup if needed
      }
    };
  }, [userLocation]);

  const handleMapPress = useCallback(() => {
    // Hide filter panel if visible
    if (showFilterPanel) {
      setShowFilterPanel(false);
      return;
    }

    // Only proceed if we actually have a selected item
    if (selectedItem) {
      // First publish the MAP_ITEM_DESELECTED event before clearing the selection
      // Import the exact types from EventBroker.tsx to ensure type compatibility
      // We need to create the properly typed item for the MapItemEvent
      if (selectedItem.type === "marker") {
        // Create a MarkerItem compatible with EventBroker's definition
        const markerItem: import("@/services/EventBroker").MarkerItem = {
          id: selectedItem.id,
          type: "marker",
          coordinates: selectedItem.coordinates,
          markerData: selectedItem.data,
        };

        // Publish with correct typing
        publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
          timestamp: Date.now(),
          source: "MapPress",
          item: markerItem,
        });
      } else {
        // Create a ClusterItem compatible with EventBroker's definition
        const clusterItem: import("@/services/EventBroker").ClusterItem = {
          id: selectedItem.id,
          type: "cluster",
          coordinates: selectedItem.coordinates,
          count: selectedItem.count,
          childMarkers: selectedItem.childrenIds,
        };

        // Publish with correct typing
        publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
          timestamp: Date.now(),
          source: "MapPress",
          item: clusterItem,
        });
      }

      // Then clear the selection in the store
      selectMapItem(null);
    }
  }, [selectMapItem, selectedItem, publish, showFilterPanel]);

  const handleMapViewportChange = (feature: any) => {
    try {
      if (
        feature?.properties?.visibleBounds &&
        Array.isArray(feature.properties.visibleBounds) &&
        feature.properties.visibleBounds.length === 2 &&
        Array.isArray(feature.properties.visibleBounds[0]) &&
        Array.isArray(feature.properties.visibleBounds[1])
      ) {
        const [[west, north], [east, south]] = feature.properties.visibleBounds;

        const adjustedWest = Math.min(west, east);
        const adjustedEast = Math.max(west, east);

        updateViewport({
          north,
          south,
          east: adjustedEast,
          west: adjustedWest,
        });

        handleGravitationalViewportChange(feature);
      } else {
        console.warn("Invalid viewport bounds received:", feature?.properties?.visibleBounds);
      }
    } catch (error) {
      console.error("Error processing viewport change:", error);
      // Provide fallback behavior or recovery mechanism
    }
  };

  const handleUserPan = useCallback(() => {
    selectMapItem(null);

    // Hide filter panel if visible
    if (showFilterPanel) {
      setShowFilterPanel(false);
    }

    console.log("USER_PANNING");
    publish<BaseEvent>(EventTypes.USER_PANNING_VIEWPORT, {
      timestamp: Date.now(),
      source: "MapPress",
    });
  }, [showFilterPanel]);

  // Handler for applying a filter
  const handleFilterSelect = useCallback(
    async (filterName: string) => {
      const filter = FILTER_OPTIONS.find((opt) => opt.name === filterName);
      if (!filter) return;

      // First remove any existing subscriptions
      for (const sub of subscriptions) {
        await deleteSubscription(sub.id);
      }

      // Then create the new subscription
      await createSubscription(
        {
          categories: filter.categories,
          tags: filter.tags,
        },
        filter.name
      );

      setActiveFilter(filterName);
      setShowFilterPanel(false);

      // Publish event
      publish<BaseEvent>(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "FilterPanel",
      });
    },
    [subscriptions, deleteSubscription, createSubscription, publish]
  );

  // Handler for clearing all filters
  const handleClearFilters = useCallback(async () => {
    // Delete all subscriptions
    for (const sub of subscriptions) {
      await deleteSubscription(sub.id);
    }

    setActiveFilter(null);
    setShowFilterPanel(false);

    // Publish event
    publish<BaseEvent>(EventTypes.NOTIFICATION, {
      timestamp: Date.now(),
      source: "FilterPanel",
    });
  }, [subscriptions, deleteSubscription, publish]);

  return (
    <AuthWrapper>
      <View style={styles.container}>
        {isLoadingLocation && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4dabf7" />
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        )}

        <MapboxGL.MapView
          onTouchStart={handleUserPan}
          onPress={handleMapPress}
          scaleBarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          ref={mapRef}
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Light}
          logoEnabled={false}
          attributionEnabled={false}
          onDidFinishLoadingMap={() => {
            setIsMapReady(true);

            // Emit map ready event
            publish<BaseEvent>(EventTypes.MAP_READY, {
              timestamp: Date.now(),
              source: "HomeScreen",
            });
          }}
          onRegionIsChanging={(feature) => {
            handleMapViewportChange(feature);
            publish<BaseEvent>(EventTypes.VIEWPORT_CHANGING, { timestamp: Date.now() });
          }}
        >
          {/* Use our camera ref for more control */}
          <MapboxGL.Camera
            pitch={55}
            heading={-15}
            ref={cameraRef}
            defaultSettings={{
              // Default to Orem, UT if no user location
              centerCoordinate: userLocation!,
              zoomLevel: 14,
            }}
            animationDuration={0}
          />

          {/* User location marker */}
          {userLocation && locationPermissionGranted && (
            <MapboxGL.PointAnnotation
              id="userLocation"
              coordinate={userLocation}
              title="Your Location"
            >
              <View style={styles.userLocationMarker}>
                <View style={styles.userLocationDot} />
              </View>
            </MapboxGL.PointAnnotation>
          )}

          {/* Custom Map Markers - Using our simplified component with unified selection */}
          {isMapReady && !isLoadingLocation && currentViewport && (
            <ClusteredMapMarkers markers={markers} viewport={currentViewport} />
          )}

          {/* Add user location layer for the blue dot */}
          {locationPermissionGranted && (
            <MapboxGL.UserLocation visible={true} showsUserHeadingIndicator={true} />
          )}
        </MapboxGL.MapView>

        {isGravitating && (
          <Animated.View
            style={[
              styles.pulseOverlay,
              {
                opacity: 0.15,
              },
            ]}
          />
        )}

        {isMapReady && !isLoadingLocation && (
          <>
            <ConnectionIndicator
              eventsCount={markers.length}
              initialConnectionState={isConnected}
              position="top-right"
              showAnimation={!selectedItem}
            />
            <QueueIndicator position="top-left" />

            {/* Add filter button */}
            <TouchableOpacity
              style={{
                position: "absolute",
                top: 120,
                right: 10,
                backgroundColor: activeFilter ? "#4dabf7" : "white",
                padding: 10,
                borderRadius: 30,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 3,
              }}
              onPress={() => setShowFilterPanel(!showFilterPanel)}
            >
              <FilterIcon size={24} color={activeFilter ? "white" : "#555"} />
            </TouchableOpacity>

            {/* Filter panel */}
            {showFilterPanel && (
              <View
                style={{
                  position: "absolute",
                  top: 200,
                  right: 10,
                  backgroundColor: "white",
                  padding: 15,
                  borderRadius: 8,
                  width: 200,
                  shadowColor: "#000",
                  shadowOpacity: 0.2,
                  shadowRadius: 6,
                  elevation: 5,
                }}
              >
                <Text style={{ fontWeight: "bold", marginBottom: 10, fontSize: 16 }}>
                  Filter Events
                </Text>

                {FILTER_OPTIONS.map((filter) => (
                  <TouchableOpacity
                    key={filter.name}
                    style={{
                      padding: 10,
                      marginVertical: 4,
                      backgroundColor: activeFilter === filter.name ? "#e6f3ff" : "transparent",
                      borderRadius: 4,
                    }}
                    onPress={() => handleFilterSelect(filter.name)}
                  >
                    <Text>{filter.name}</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={{
                    padding: 10,
                    marginTop: 8,
                    backgroundColor: "#f0f0f0",
                    borderRadius: 4,
                    alignItems: "center",
                  }}
                  onPress={handleClearFilters}
                >
                  <Text>Clear Filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {isMapReady && !isLoadingLocation && (
          <View style={styles.assistantOverlay}>
            <EventAssistant />
          </View>
        )}
      </View>
    </AuthWrapper>
  );
}
