import React, { useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import {
  Search as SearchIcon,
  X,
  Bookmark,
  Compass,
} from "lucide-react-native";
import { TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import EventListItem, {
  EventListItemProps,
} from "@/components/Event/EventListItem";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import {
  EventResponse as ApiEventType,
  EventResponse,
} from "@realtime-markers/types";
import { AuthWrapper } from "@/components/AuthWrapper";

type SavedTab = "personal" | "discovered";

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
      icon: Compass,
      label: "Discovered",
      value: "discovered" as SavedTab,
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
    (event: EventResponse) => {
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
    (event: ApiEventType) => {
      const eventProps: EventListItemProps = {
        ...event,
        onPress: handleEventPress,
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
    <AuthWrapper>
      <Screen
        isScrollable={false}
        bannerTitle="Saved"
        bannerEmoji="🔖"
        showBackButton
        onBack={handleBack}
        noAnimation
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={handleTabPress}
      >
        <Input
          ref={searchInputRef}
          icon={SearchIcon}
          rightIcon={searchQuery !== "" ? X : undefined}
          onRightIconPress={handleClearSearch}
          placeholder={`Search ${activeTab === "personal" ? "your" : "discovered"} saved events...`}
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
    </AuthWrapper>
  );
};

export default SavedListScreen;
