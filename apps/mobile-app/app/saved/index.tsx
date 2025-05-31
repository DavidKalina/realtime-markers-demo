import React, { useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import { Search as SearchIcon, X, Bookmark, Users } from "lucide-react-native";
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
import Tabs from "@/components/Layout/Tabs";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { useSavedEvents } from "@/hooks/useSavedEvents";

// Define Event type to match EventType from useEventSearch
interface Event {
  id: string;
  title: string;
  description?: string;
  location: string;
  distance: string;
  emoji?: string;
}

type SavedTab = "personal" | "friends";

const SavedListScreen = () => {
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<SavedTab>("personal");

  const { events, isLoading, error, hasMore, loadMore, refresh } =
    useSavedEvents({
      type: activeTab,
    });

  // Tab items configuration
  const tabItems = [
    {
      icon: Bookmark,
      label: "My Events",
      value: "personal" as SavedTab,
    },
    {
      icon: Users,
      label: "Friends' Events",
      value: "friends" as SavedTab,
    },
  ];

  const handleTabPress = useCallback((tab: SavedTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

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
        params: { eventId: event.id },
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
          <View style={styles.eventHeader}>
            {event.emoji && (
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{event.emoji}</Text>
              </View>
            )}
            <View style={styles.titleContainer}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {event.title}
              </Text>
              {event.description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>
              )}
              {event.distance && (
                <Text style={styles.distanceText}>{event.distance}</Text>
              )}
            </View>
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
      <Tabs
        items={tabItems}
        activeTab={activeTab}
        onTabPress={handleTabPress}
        style={{ marginHorizontal: 16 }}
      />
      <Input
        ref={searchInputRef}
        icon={SearchIcon}
        rightIcon={searchQuery !== "" ? X : undefined}
        onRightIconPress={handleClearSearch}
        placeholder={`Search ${activeTab === "personal" ? "your" : "friends'"} saved events...`}
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  emoji: {
    fontSize: 18,
  },
  titleContainer: {
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
    opacity: 0.8,
    lineHeight: 20,
    marginBottom: 4,
  },
  distanceText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default SavedListScreen;
