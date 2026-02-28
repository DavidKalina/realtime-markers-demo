import React, { useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import { Search as SearchIcon, X } from "lucide-react-native";
import { TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import EventListItem, {
  EventListItemProps,
} from "@/components/Event/EventListItem";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { EventType as ApiEventType } from "@/types/types";

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
    (event: EventListItemProps) => {
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
    (event: ApiEventType, index: number) => {
      const eventProps: EventListItemProps = {
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        distance: event.distance,
        emoji: event.emoji,
        eventDate: new Date(event.eventDate),
        endDate: event.endDate,
        categories: event.categories,
        onPress: handleEventPress,
        isPrivate: event.isPrivate,
        isRecurring: event.isRecurring,
        index,
      };
      return <EventListItem {...eventProps} />;
    },
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
      bannerTitle="Saved"
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
        placeholder="Search your events..."
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
        emptyEmoji={searchQuery.trim() ? "🔍" : "🔖"}
        emptyTitle={searchQuery.trim() ? "No matches" : "No saved events yet"}
        emptySubtitle={
          searchQuery.trim()
            ? "Try a different search term"
            : "Tap the bookmark on any event to save it here"
        }
        emptyAction={
          searchQuery.trim()
            ? { label: "Clear Search", onPress: handleClearSearch }
            : undefined
        }
        onRetry={refresh}
      />
    </Screen>
  );
};

export default SavedListScreen;
