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
} from "react-native";
import { ArrowLeft, Calendar, MapPin, Heart } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { EventType } from "@/types/types";
import apiClient from "@/services/ApiClient";
import { styles } from "../Search/styles";

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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Events</Text>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {isLoading && savedEvents.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Loading saved events...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={savedEvents}
            ListHeaderComponent={() => (
              <View>
                <Text style={styles.resultsText}>
                  {savedEvents.length > 0
                    ? `${savedEvents.length} saved ${savedEvents.length === 1 ? "event" : "events"}`
                    : "No saved events yet"}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => handleSelectEvent(item)}
              >
                <Text style={styles.resultEmoji}>{item.emoji}</Text>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultTitle} numberOfLines={1} ellipsizeMode="tail">
                    {item.title}
                  </Text>
                  <View style={styles.resultDetailsRow}>
                    <Calendar size={12} color="#93c5fd" style={{ marginRight: 4 }} />
                    <Text style={styles.resultDetailText} numberOfLines={1} ellipsizeMode="tail">
                      {item.time}
                    </Text>
                  </View>
                  <View style={styles.resultDetailsRow}>
                    <MapPin size={12} color="#93c5fd" style={{ marginRight: 4 }} />
                    <Text style={styles.resultDetailText} numberOfLines={1} ellipsizeMode="tail">
                      {item.location}
                    </Text>
                  </View>
                </View>
                <Heart size={18} color="#93c5fd" fill="#93c5fd" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={() =>
              !isLoading ? (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>You haven't saved any events yet.</Text>
                  <Text style={styles.noResultsSubtext}>Events you save will appear here.</Text>
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
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchSavedEvents(true)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default SavedEventsView;
