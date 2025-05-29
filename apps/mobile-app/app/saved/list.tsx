import React, { useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import { Search as SearchIcon, X, MapPin } from "lucide-react-native";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { useSavedEvents } from "@/hooks/useSavedEvents";

// Define Event type to match EventType from useEventSearch
interface Event {
  id: string;
  title: string;
  description?: string;
  location: string;
  distance: string;
}

const SavedListScreen = () => {
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  const { events, isLoading, error, hasMore, loadMore, refresh } =
    useSavedEvents();

  // Search input handlers
  const handleSearchInput = useCallback((text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery(text);
  }, []);

  const handleSearch = useCallback(async () => {
    // TODO: Implement search functionality when backend supports it
    await refresh();
  }, [refresh]);

  const handleClearSearch = useCallback(() => {
    Haptics.selectionAsync();
    setSearchQuery("");
    searchInputRef.current?.focus();
  }, []);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleEventPress = useCallback(
    (event: Event) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/details" as const,
        params: { id: event.id },
      });
    },
    [router],
  );

  // Auto-focus the search input when the screen opens
  React.useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 500);
  }, []);

  const renderEventItem = useCallback(
    (event: Event) => (
      <TouchableOpacity
        style={styles.eventItem}
        onPress={() => handleEventPress(event)}
        activeOpacity={0.7}
      >
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {event.title}
          </Text>
          {event.description && (
            <Text style={styles.eventDescription} numberOfLines={2}>
              {event.description}
            </Text>
          )}
          <View style={styles.eventFooter}>
            <View style={styles.locationContainer}>
              <MapPin size={14} color={COLORS.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {event.location || "Location not specified"}
              </Text>
            </View>
            {event.distance && (
              <Text style={styles.distanceText}>{event.distance}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    ),
    [handleEventPress],
  );

  // Filter events based on search query
  const filteredEvents = React.useMemo(() => {
    if (!searchQuery.trim()) return events;

    const query = searchQuery.toLowerCase();
    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query),
    );
  }, [events, searchQuery]);

  return (
    <Screen
      isScrollable={false}
      bannerTitle="Saved Events"
      bannerDescription="Browse and search your saved events"
      bannerEmoji="🔖"
      showBackButton
      onBack={handleBack}
      noAnimation
    >
      <Input
        ref={searchInputRef}
        icon={SearchIcon}
        rightIcon={searchQuery !== "" ? X : undefined}
        onRightIconPress={handleClearSearch}
        placeholder="Search your saved events..."
        value={searchQuery}
        onChangeText={handleSearchInput}
        returnKeyType="search"
        onSubmitEditing={handleSearch}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={true}
        loading={isLoading}
        style={{ marginHorizontal: 16, marginBottom: 16 }}
      />
      <InfiniteScrollFlatList
        data={filteredEvents}
        renderItem={renderEventItem}
        fetchMoreData={loadMore}
        onRefresh={refresh}
        isLoading={isLoading}
        isRefreshing={isLoading && events.length === 0}
        hasMore={hasMore && !error}
        error={error}
        emptyListMessage={
          searchQuery.trim()
            ? "No saved events found matching your search"
            : "No saved events found"
        }
        onRetry={refresh}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  eventItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 4,
  },
  eventDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginBottom: 8,
    opacity: 0.8,
  },
  eventFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  locationText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 4,
    opacity: 0.8,
  },
  distanceText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default SavedListScreen;
