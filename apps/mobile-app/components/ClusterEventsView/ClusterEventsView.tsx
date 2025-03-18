import apiClient from "@/services/ApiClient";
import { useLocationStore } from "@/stores/useLocationStore";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { AlertCircle, ArrowLeft, Clock, Info, MapIcon, MapPin } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Import or define the MapItem types
interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

interface MarkerItem extends BaseMapItem {
  type: "marker";
  data: any; // Use your marker data type here
}

interface ClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[];
}

type MapItem = MarkerItem | ClusterItem;

// Define geocoding info type
interface GeocodingInfo {
  placeName: string;
  neighborhood?: string;
  locality?: string;
  place?: string;
  region?: string;
}

// Cache for cluster names to prevent duplicate API calls
const clusterNameCache: Record<string, { name: string; geocodingInfo?: GeocodingInfo }> = {};

const ClusterEventsView: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [clusterName, setClusterName] = useState<string | null>(null);
  const [geocodingInfo, setGeocodingInfo] = useState<GeocodingInfo | null>(null);
  const [isLoadingName, setIsLoadingName] = useState(false);
  const [showGeocodingDetails, setShowGeocodingDetails] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Animation for header shadow
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Use the unified selection from the store
  const selectedItem = useLocationStore((state) => state.selectedItem);
  const markers = useLocationStore((state) => state.markers);
  const selectMapItem = useLocationStore((state) => state.selectMapItem);
  const zoomLevel = useLocationStore((state) => state.zoomLevel || 12);

  // Keep a local copy of the cluster data to handle navigation away and back
  const [localCluster, setLocalCluster] = useState<ClusterItem | null>(null);

  const listRef = useRef<FlatList>(null);

  // Store cluster data locally when it's available from the unified selection
  useEffect(() => {
    if (selectedItem?.type === "cluster" && !localCluster) {
      setLocalCluster(selectedItem as ClusterItem);
    }
  }, [selectedItem, localCluster]);

  // Get the effective cluster data (either from store or local state)
  const effectiveCluster =
    selectedItem?.type === "cluster" ? (selectedItem as ClusterItem) : localCluster;

  const clusterCount = effectiveCluster?.count;
  const clusterCoordinates = effectiveCluster?.coordinates;

  // Generate a stable ID for the cluster
  const getClusterId = useCallback(() => {
    if (!effectiveCluster) return null;
    return `cluster-${effectiveCluster.coordinates.join(",")}-${effectiveCluster.count}`;
  }, [effectiveCluster]);

  // Toggle geocoding info visibility
  const toggleGeocodingDetails = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowGeocodingDetails(!showGeocodingDetails);
  }, [showGeocodingDetails]);

  // Fetch AI-generated cluster name with geocoding
  const fetchClusterName = useCallback(async () => {
    if (!effectiveCluster || !clusterCoordinates) return;

    const clusterId = getClusterId();
    if (!clusterId) return;

    // Check if we already have this cluster name in cache
    if (clusterNameCache[clusterId]) {
      setClusterName(clusterNameCache[clusterId].name);
      setGeocodingInfo(clusterNameCache[clusterId].geocodingInfo || null);
      return;
    }

    setIsLoadingName(true);

    try {
      // Call the API to generate the cluster name
      const results = await apiClient.generateClusterNames({
        clusters: [
          {
            id: clusterId,
            location: clusterCoordinates,
            pointCount: clusterCount || 0,
          },
        ],
        zoom: zoomLevel,
      });

      if (results && results.length > 0) {
        const result = results[0];
        setClusterName(result.generatedName);

        // Save geocoding info if available
        if (result.geocodingInfo) {
          setGeocodingInfo(result.geocodingInfo);
        }

        // Store in local cache to prevent duplicate API calls
        clusterNameCache[clusterId] = {
          name: result.generatedName,
          geocodingInfo: result.geocodingInfo,
        };
      }
    } catch (error) {
      console.error("Error fetching cluster name:", error);
      // Fallback to a basic name on error
      setClusterName("Events Cluster");
    } finally {
      setIsLoadingName(false);
    }
  }, [effectiveCluster, clusterCoordinates, clusterCount, getClusterId, zoomLevel]);

  // Restore cluster selection when returning to this screen if needed
  useFocusEffect(
    useCallback(() => {
      // If we have local cluster data but no cluster is selected, restore the selection
      if (localCluster && (!selectedItem || selectedItem.type !== "cluster")) {
        selectMapItem(localCluster);
      }

      return () => {
        // No cleanup needed
      };
    }, [localCluster, selectedItem, selectMapItem])
  );

  // Function to fetch cluster events using the effective cluster data
  const fetchClusterEvents = useCallback(async () => {
    try {
      setIsLoading(true);

      if (!clusterCoordinates && !markers.length) {
        throw new Error("Could not determine cluster location");
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      let clusterEvents: EventType[] = [];

      // If we have coordinates, filter markers by proximity
      if (clusterCoordinates) {
        const MAX_DISTANCE = 0.05; // Rough distance in degrees (~5km)

        // Use existing markers that are near the cluster
        clusterEvents = markers
          .filter((marker) => {
            // Calculate rough distance to cluster
            const markerLng = marker.coordinates[0];
            const markerLat = marker.coordinates[1];
            const clusterLng = clusterCoordinates[0];
            const clusterLat = clusterCoordinates[1];

            const distance = Math.sqrt(
              Math.pow(markerLng - clusterLng, 2) + Math.pow(markerLat - clusterLat, 2)
            );

            return distance < MAX_DISTANCE;
          })
          .map((marker) => ({
            id: marker.id,
            title: marker.data?.title || "Unnamed Event",
            emoji: marker.data?.emoji || "📍",
            time: marker.data?.time || new Date().toLocaleDateString(),
            location: marker.data?.location || "Unknown location",
            distance: marker.data?.distance || `${(Math.random() * 2).toFixed(1)} mi away`,
            description: marker.data?.description || "",
            categories: marker.data?.categories || [],
            isVerified: marker.data?.isVerified || false,
          }));
      }

      // If we don't have enough events from proximity filtering,
      // add some dummy events to meet expected count
      const clusterSize = effectiveCluster ? effectiveCluster.count : 10;

      if (clusterEvents.length < clusterSize) {
        const additionalEventsNeeded = clusterSize - clusterEvents.length;

        const dummyEvents: EventType[] = Array.from({ length: additionalEventsNeeded }, (_, i) => ({
          id: `event-dummy-${i}`,
          title: `Event ${i + 1} in Cluster`,
          emoji: ["🎉", "🎵", "🎸", "🎭", "🎨", "🎤", "🎬", "🎮", "🏆", "🍔"][i % 10],
          time: `${new Date().toLocaleDateString()} • ${Math.floor(Math.random() * 12) + 1}:00 PM`,
          location: `Venue ${i + 1}, City Center`,
          distance: `${(Math.random() * 2).toFixed(1)} mi away`,
          description: "Join us for this exciting event!",
          categories: ["entertainment", "music"],
          isVerified: Math.random() > 0.5,
        }));

        clusterEvents = [...clusterEvents, ...dummyEvents];
      }

      setEvents(clusterEvents);
      setError(null);
    } catch (err) {
      setError("Failed to load events. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [clusterCoordinates, markers, effectiveCluster]);

  // Initial data loading
  useEffect(() => {
    if (effectiveCluster) {
      fetchClusterEvents();
      fetchClusterName();
    }
  }, [effectiveCluster, fetchClusterEvents, fetchClusterName]);

  // Handle back button - clear selection using unified approach
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Clear selection using unified method
    selectMapItem(null);
    router.back();
  };

  // Handle select event with the unified approach
  const handleSelectEvent = (event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Keep the cluster data to support returning to this view later
    if (selectedItem?.type === "cluster") {
      setLocalCluster(selectedItem as ClusterItem);
    }

    // Select the marker in the store if it's a real marker (not a dummy)
    if (event.id && !event.id.startsWith("event-dummy-")) {
      // Find the marker in the markers array
      const marker = markers.find((m) => m.id === event.id);

      if (marker) {
        // Create a marker map item for the unified selection
        const markerItem: MarkerItem = {
          id: marker.id,
          type: "marker",
          coordinates: marker.coordinates,
          data: marker.data,
        };

        // Select using unified method - doesn't clear other selection data
        selectMapItem(markerItem);
      }
    }

    // Navigate to event details
    router.push(`/details?eventId=${event.id}` as never);
  };

  // Handle loading more events
  const handleLoadMore = () => {
    if (isFetchingMore || events.length < 10) return;

    setIsFetchingMore(true);

    // Simulate loading more events
    setTimeout(() => {
      const moreEvents: EventType[] = Array.from({ length: 5 }, (_, i) => ({
        description: "",
        id: `event-more-${i + events.length}`,
        title: `Event ${i + events.length + 1} in Cluster`,
        emoji: ["🎉", "🎵", "🎸", "🎭", "🎨", "🎤", "🎬", "🎮", "🏆", "🍔"][i % 10],
        time: `${new Date().toLocaleDateString()} • ${Math.floor(Math.random() * 12) + 1}:00 PM`,
        location: `Venue ${i + events.length + 1}, City Center`,
        distance: `${(Math.random() * 5).toFixed(1)} mi away`,
      }));

      setEvents((prev) => [...prev, ...moreEvents]);
      setIsFetchingMore(false);
    }, 1000);
  };

  // Render footer with loading indicator when fetching more
  const renderFooter = () => {
    if (!isFetchingMore) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#93c5fd" />
        <Text style={styles.loadingFooterText}>Loading more events...</Text>
      </View>
    );
  };

  // Get the header title to display
  const getHeaderTitle = () => {
    if (isLoadingName) return "Loading...";
    return clusterName || "Cluster Events";
  };

  // Render geocoding info panel
  const renderGeocodingInfo = () => {
    if (!showGeocodingDetails || !geocodingInfo) return null;

    return (
      <View style={styles.geocodingContainer}>
        <Text style={styles.geocodingTitle}>Location Details</Text>

        {geocodingInfo.neighborhood && (
          <View style={styles.geocodingRow}>
            <Text style={styles.geocodingLabel}>Neighborhood:</Text>
            <Text style={styles.geocodingValue}>{geocodingInfo.neighborhood}</Text>
          </View>
        )}

        {geocodingInfo.locality && (
          <View style={styles.geocodingRow}>
            <Text style={styles.geocodingLabel}>Locality:</Text>
            <Text style={styles.geocodingValue}>{geocodingInfo.locality}</Text>
          </View>
        )}

        {geocodingInfo.place && (
          <View style={styles.geocodingRow}>
            <Text style={styles.geocodingLabel}>Place:</Text>
            <Text style={styles.geocodingValue}>{geocodingInfo.place}</Text>
          </View>
        )}

        {geocodingInfo.region && (
          <View style={styles.geocodingRow}>
            <Text style={styles.geocodingLabel}>Region:</Text>
            <Text style={styles.geocodingValue}>{geocodingInfo.region}</Text>
          </View>
        )}
      </View>
    );
  };

  // If we have no cluster data at all, show an error
  if (!effectiveCluster) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#333" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#f8f9fa" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cluster Events</Text>
        </View>

        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIconContainer}>
            <MapIcon size={40} color="#93c5fd" style={{ opacity: 0.6 }} />
          </View>
          <Text style={styles.emptyStateTitle}>No Cluster Data Available</Text>
          <Text style={styles.emptyStateDescription}>
            We couldn't find any cluster information. Please return to the map and select a cluster.
          </Text>

          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <MapIcon size={16} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.emptyStateButtonText}>Return to Map</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          {
            shadowOpacity: headerShadowOpacity,
            borderBottomColor: headerShadowOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", "#3a3a3a"],
            }),
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {getHeaderTitle()}
          </Text>
        </View>

        {clusterCount && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{clusterCount}</Text>
          </View>
        )}
      </Animated.View>

      {/* Geocoding Info Panel (conditionally rendered) */}
      {renderGeocodingInfo()}

      {/* Content Area */}
      <View style={styles.contentArea}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef}
            data={events}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            ListHeaderComponent={() => (
              <View style={styles.listHeader}>
                <View style={styles.resultsContainer}>
                  <Text style={styles.resultsText}>
                    {events.length} {events.length === 1 ? "event" : "events"} in this area
                  </Text>
                </View>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.eventCard}
                onPress={() => handleSelectEvent(item)}
                activeOpacity={0.8}
              >
                <View style={styles.eventCardContent}>
                  {/* Emoji Container */}
                  <View style={styles.emojiContainer}>
                    <Text style={styles.eventEmoji}>{item.emoji || "📍"}</Text>
                  </View>

                  {/* Event Details */}
                  <View style={styles.eventTextContainer}>
                    <Text style={styles.eventTitle} numberOfLines={1} ellipsizeMode="tail">
                      {item.title}
                    </Text>

                    <View style={styles.detailsContainer}>
                      <View style={styles.eventDetailsRow}>
                        <Clock size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                        <Text style={styles.eventDetailText} numberOfLines={1} ellipsizeMode="tail">
                          {item.time}
                        </Text>
                      </View>

                      <View style={styles.eventDetailsRow}>
                        <MapPin size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                        <Text style={styles.eventDetailText} numberOfLines={1} ellipsizeMode="tail">
                          {item.distance ? item.distance : item.location}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyStateIconContainer}>
                  <MapIcon size={40} color="#93c5fd" style={{ opacity: 0.6 }} />
                </View>
                <Text style={styles.emptyStateTitle}>No Events Found</Text>
                <Text style={styles.emptyStateDescription}>
                  We couldn't find any events in this area. Try exploring a different area on the
                  map.
                </Text>

                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={handleBack}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonContent}>
                    <MapIcon size={16} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.emptyStateButtonText}>Return to Map</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
            ListFooterComponent={renderFooter}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, events.length === 0 && { flexGrow: 1 }]}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
          />
        )}

        {/* Error display */}
        {error && (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <AlertCircle size={18} color="#f97583" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchClusterEvents()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

// Inline styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    backgroundColor: "#333",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 3,
    elevation: 0,
  },

  backButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
  },

  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
  },

  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  countBadge: {
    backgroundColor: "rgba(147, 197, 253, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
    minWidth: 32,
    alignItems: "center",
  },

  countText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  // Geocoding panel
  geocodingContainer: {
    backgroundColor: "#3a3a3a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 8,
  },

  geocodingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },

  geocodingRow: {
    flexDirection: "row",
    marginBottom: 4,
  },

  geocodingLabel: {
    fontSize: 13,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    marginRight: 8,
    width: 100,
  },

  geocodingValue: {
    fontSize: 13,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
  },

  // Content area
  contentArea: {
    flex: 1,
  },

  // List styles
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  listHeader: {
    marginVertical: 12,
  },

  resultsContainer: {
    paddingVertical: 8,
  },

  resultsText: {
    fontSize: 14,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
  },

  // Event card
  eventCard: {
    backgroundColor: "#3a3a3a",
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
  },

  eventCardContent: {
    flexDirection: "row",
    padding: 14,
    alignItems: "center",
  },

  emojiContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  eventEmoji: {
    fontSize: 22,
  },

  eventTextContainer: {
    flex: 1,
    justifyContent: "center",
  },

  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 6,
  },

  detailsContainer: {
    gap: 4,
  },

  eventDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  eventDetailText: {
    fontSize: 13,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    flex: 1,
  },

  // Empty state
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },

  emptyStateDescription: {
    fontSize: 14,
    color: "#adb5bd",
    textAlign: "center",
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 24,
  },

  emptyStateButton: {
    position: "relative",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    overflow: "hidden",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },

  buttonGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyStateButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },

  loadingText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 16,
    marginTop: 16,
  },

  loadingFooter: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  loadingFooterText: {
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginLeft: 8,
  },

  // Error state
  errorContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
    flexDirection: "row",
    alignItems: "center",
  },

  errorIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(249, 117, 131, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    flex: 1,
  },

  retryButton: {
    backgroundColor: "rgba(249, 117, 131, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },

  retryButtonText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    fontSize: 14,
  },
});

export default ClusterEventsView;
