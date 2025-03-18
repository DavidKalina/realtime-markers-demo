import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  StyleSheet,
} from "react-native";
import { ArrowLeft, Calendar, MapPin, Heart, Bookmark, Search } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { EventType } from "@/types/types";
import apiClient from "@/services/ApiClient";

const SavedEventsView: React.FC = () => {
  const router = useRouter();
  const [savedEvents, setSavedEvents] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const pageSize = 10;

  const listRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Computed styles based on scroll position
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Fetch saved events
  const fetchSavedEvents = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
        setPage(0);
        setHasMore(true);
      } else if (!refresh && isLoading === false) {
        setIsFetchingMore(true);
      }

      const offset = refresh ? 0 : page * pageSize;

      const response = await apiClient.getSavedEvents({
        limit: pageSize,
        offset: offset,
      });

      if (refresh) {
        setSavedEvents(response.events);
      } else {
        setSavedEvents((prev) => [...prev, ...response.events]);
      }

      setHasMore(response.hasMore);
      setPage((prev) => (refresh ? 0 : prev) + 1);
      setError(null);
    } catch (err) {
      setError("Failed to load saved events. Please try again.");
      console.error("Error fetching saved events:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFetchingMore(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchSavedEvents();
  }, []);

  // Handle refreshing
  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchSavedEvents(true);
  };

  // Handle loading more
  const handleLoadMore = () => {
    if (!isFetchingMore && !isRefreshing && hasMore) {
      fetchSavedEvents();
    }
  };

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // Handle select event
  const handleSelectEvent = (event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to event details
    if (event.id) {
      router.push(`/details?eventId=${event.id}`);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header with animation */}
      <Animated.View
        style={[
          styles.header,
          {
            shadowOpacity: headerOpacity,
            borderBottomColor: headerOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", "#3a3a3a"],
            }),
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Events</Text>

        <View style={styles.headerIconContainer}>
          <Bookmark size={20} color="#93c5fd" fill="#93c5fd" />
        </View>
      </Animated.View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {isLoading && savedEvents.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Loading saved events...</Text>
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef}
            data={savedEvents}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            ListHeaderComponent={() => (
              <View style={styles.listHeader}>
                <View style={styles.counterContainer}>
                  <Text style={styles.resultsText}>
                    {savedEvents.length > 0
                      ? `${savedEvents.length} saved ${
                          savedEvents.length === 1 ? "event" : "events"
                        }`
                      : "No saved events yet"}
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
                  <View style={styles.emojiContainer}>
                    <Text style={styles.resultEmoji}>{item.emoji || "📍"}</Text>
                  </View>

                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle} numberOfLines={1} ellipsizeMode="tail">
                      {item.title}
                    </Text>

                    <View style={styles.detailsContainer}>
                      <View style={styles.resultDetailsRow}>
                        <Calendar size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                        <Text
                          style={styles.resultDetailText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.time}
                        </Text>
                      </View>

                      <View style={styles.resultDetailsRow}>
                        <MapPin size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                        <Text
                          style={styles.resultDetailText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.location}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.savedBadge}>
                    <Heart size={16} color="#93c5fd" fill="#93c5fd" />
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() =>
              !isLoading ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIconContainer}>
                    <Bookmark size={40} color="#93c5fd" style={{ opacity: 0.6 }} />
                  </View>
                  <Text style={styles.emptyStateTitle}>No saved events yet</Text>
                  <Text style={styles.emptyStateDescription}>
                    Events you save will appear here. To save an event, tap the bookmark icon on any
                    event details page.
                  </Text>

                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => router.push("/search")}
                    activeOpacity={0.8}
                  >
                    <View style={styles.buttonContent}>
                      <Search size={16} color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={styles.emptyStateButtonText}>Find Events</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            ListFooterComponent={renderFooter}
            keyExtractor={(item) => item.id as string}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              savedEvents.length === 0 && { flexGrow: 1 },
            ]}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#93c5fd"
                colors={["#93c5fd"]}
              />
            }
          />
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchSavedEvents(true)}
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

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
  },

  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
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

  counterContainer: {
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

  resultEmoji: {
    fontSize: 22,
  },

  resultTextContainer: {
    flex: 1,
    justifyContent: "center",
  },

  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 6,
  },

  detailsContainer: {
    gap: 4,
  },

  resultDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  resultDetailText: {
    fontSize: 13,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    flex: 1,
  },

  savedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
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
    alignItems: "center",
  },

  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },

  retryButton: {
    backgroundColor: "rgba(249, 117, 131, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
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

export default SavedEventsView;
