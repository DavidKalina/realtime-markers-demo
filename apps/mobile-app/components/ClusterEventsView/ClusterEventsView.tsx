import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { ArrowLeft, Calendar, MapPin } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter, useFocusEffect } from "expo-router";
import { EventType } from "@/types/types";
import { useLocationStore } from "@/stores/useLocationStore";
import { styles } from "./styles";

const ClusterEventsView: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Keep a local copy of the cluster data to handle navigation
  const [localCluster, setLocalCluster] = useState<any>(null);

  // Get data from location store
  const selectedCluster = useLocationStore((state) => state.selectedCluster);
  const markers = useLocationStore((state) => state.markers);
  const selectMarker = useLocationStore((state) => state.selectMarker);
  const selectCluster = useLocationStore((state) => state.selectCluster);

  const listRef = useRef<FlatList>(null);

  // Store cluster data locally when it's available
  useEffect(() => {
    if (selectedCluster && !localCluster) {
      setLocalCluster(selectedCluster);
    }
  }, [selectedCluster, localCluster]);

  // Get the effective cluster data (either from store or local state)
  const effectiveCluster = selectedCluster || localCluster;
  const clusterCount = effectiveCluster?.count;
  const clusterCoordinates = effectiveCluster?.coordinates;

  // Restore cluster selection when returning to this screen if needed
  useFocusEffect(
    useCallback(() => {
      // If we have local cluster data but nothing selected in the store,
      // restore the cluster selection
      if (localCluster && !selectedCluster) {
        selectCluster({
          // Create minimum data needed for the store's selectCluster function
          properties: {
            cluster_id: localCluster.id.replace("cluster-", ""),
            point_count: localCluster.count,
          },
          geometry: {
            coordinates: localCluster.coordinates,
          },
          type: "Feature",
        } as any);
      }

      return () => {
        // No cleanup needed
      };
    }, [localCluster, selectedCluster, selectCluster])
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
    }
  }, [effectiveCluster, fetchClusterEvents]);

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectMarker(null);
    selectCluster(null);
    router.back();
  };

  // Handle select event with special handling to preserve cluster selection
  const handleSelectEvent = (event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Save current cluster before selecting a marker
    const currentCluster = selectedCluster || localCluster;

    // Select the marker in the store if it's a real marker (not a dummy)
    if (event.id && !event.id.startsWith("event-dummy-")) {
      // The issue: selectMarker is clearing the cluster selection
      selectMarker(event.id);
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
        <Text style={styles.loadingFooterText}>Loading more...</Text>
      </View>
    );
  };

  // If we have no cluster data at all, show an error
  if (!effectiveCluster) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#333" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={22} color="#f8f9fa" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cluster Events</Text>
        </View>
        <View style={[styles.contentArea, styles.loadingContainer]}>
          <Text style={styles.errorText}>No cluster data available</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cluster Events</Text>
        {clusterCount && <Text style={styles.clusterCount}>{clusterCount} events</Text>}
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={events}
            ListHeaderComponent={() => (
              <View>
                <Text style={styles.resultsText}>
                  {events.length} {events.length === 1 ? "event" : "events"} in this cluster
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.eventItem} onPress={() => handleSelectEvent(item)}>
                <Text style={styles.eventEmoji}>{item.emoji}</Text>
                <View style={styles.eventTextContainer}>
                  <Text style={styles.eventTitle} numberOfLines={1} ellipsizeMode="tail">
                    {item.title}
                  </Text>
                  <View style={styles.eventDetailsRow}>
                    <Calendar size={12} color="#93c5fd" style={{ marginRight: 4 }} />
                    <Text style={styles.eventDetailText} numberOfLines={1} ellipsizeMode="tail">
                      {item.time}
                    </Text>
                  </View>
                  <View style={styles.eventDetailsRow}>
                    <MapPin size={12} color="#93c5fd" style={{ marginRight: 4 }} />
                    <Text style={styles.eventDetailText} numberOfLines={1} ellipsizeMode="tail">
                      {item.distance ? item.distance : item.location}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No events found in this area.</Text>
                <Text style={styles.noResultsSubtext}>Try exploring a different area.</Text>
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

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                fetchClusterEvents();
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default ClusterEventsView;
