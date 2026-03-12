import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  Compass,
  MapPin,
  Music,
  Search as SearchIcon,
  Ticket,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import EventListItem, {
  EventListItemProps,
} from "@/components/Event/EventListItem";
import useEventSearch from "@/hooks/useEventSearch";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserLocation } from "@/contexts/LocationContext";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";

type EventType = Omit<EventListItemProps, "onPress">;

const SearchScreen = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const searchInputRef = useRef<TextInput>(null);
  const storedMarkers = useLocationStore((state) => state.markers);
  const { userLocation } = useUserLocation();

  const {
    searchQuery,
    setSearchQuery,
    eventResults,
    isLoading,
    error,
    searchEvents,
    handleLoadMore: loadMoreEvents,
    clearSearch,
    hasSearched,
  } = useEventSearch({ initialMarkers: storedMarkers });

  const handleSearchInput = useCallback(
    (text: string) => {
      setSearchQuery(text);
    },
    [setSearchQuery],
  );

  const handleSearch = useCallback(async () => {
    await searchEvents(true);
  }, [searchEvents]);

  const handleClearSearch = useCallback(() => {
    Haptics.selectionAsync();
    clearSearch();
    searchInputRef.current?.focus();
  }, [clearSearch]);

  const handleEventPress = useCallback(
    (event: EventType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/details" as const,
        params: { eventId: event.id },
      });
    },
    [router],
  );

  const handleLoadMore = useCallback(async (): Promise<void> => {
    await loadMoreEvents();
  }, [loadMoreEvents]);

  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 300);
  }, []);

  const renderEventItem = useCallback(
    (event: EventType, index: number) => {
      let distance = event.distance || "";
      if (!distance && userLocation && event.coordinates) {
        const [lng, lat] = userLocation;
        const [eLng, eLat] = event.coordinates;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const R = 3958.8;
        const dLat = toRad(eLat - lat);
        const dLng = toRad(eLng - lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat)) *
            Math.cos(toRad(eLat)) *
            Math.sin(dLng / 2) ** 2;
        const mi = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = mi < 0.1 ? "Nearby" : `${mi.toFixed(1)} mi`;
      }
      return (
        <EventListItem
          {...event}
          distance={distance}
          eventDate={new Date(event.eventDate)}
          onPress={handleEventPress}
          index={index}
        />
      );
    },
    [handleEventPress, userLocation],
  );

  const showResults = hasSearched || !!searchQuery.trim();

  return (
    <View style={styles.container}>
      <Input
        ref={searchInputRef}
        icon={SearchIcon}
        rightIcon={searchQuery !== "" ? X : undefined}
        onRightIconPress={handleClearSearch}
        placeholder="Search events, venues, categories..."
        value={searchQuery}
        onChangeText={handleSearchInput}
        returnKeyType="search"
        onSubmitEditing={handleSearch}
        autoCapitalize="none"
        autoCorrect={false}
        loading={isLoading}
        style={styles.searchInput}
      />

      {showResults ? (
        <InfiniteScrollFlatList
          data={eventResults as unknown as EventType[]}
          renderItem={renderEventItem}
          fetchMoreData={handleLoadMore}
          isLoading={isLoading}
          isRefreshing={false}
          hasMore={!error && eventResults.length > 0}
          error={error}
          emptyEmoji="🔍"
          emptyTitle={
            searchQuery.trim() ? "No results found" : "Start typing to search"
          }
          emptySubtitle={
            searchQuery.trim()
              ? `Nothing matched "${searchQuery.trim()}"`
              : "Search for events, venues, and categories"
          }
          emptyAction={
            searchQuery.trim()
              ? { label: "Clear Search", onPress: handleClearSearch }
              : undefined
          }
          onRetry={async () => await searchEvents(true)}
        />
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.iconRing}>
            <SearchIcon size={32} color={colors.accent.primary} />
          </View>
          <Text style={styles.emptyTitle}>Find your next adventure</Text>
          <Text style={styles.emptySubtitle}>
            Search by event name, venue, or category
          </Text>

          <View style={styles.suggestions}>
            <Text style={styles.suggestionsLabel}>TRY SEARCHING FOR</Text>
            <View style={styles.chips}>
              {[
                { icon: Music, label: "Concerts" },
                { icon: Ticket, label: "Comedy" },
                { icon: MapPin, label: "Food & Drink" },
                { icon: Compass, label: "Outdoors" },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.chipPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSearchQuery(item.label);
                    searchEvents(true);
                  }}
                >
                  <item.icon size={14} color={colors.text.secondary} />
                  <Text style={styles.chipText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && styles.dismissPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <ChevronDown size={16} color={colors.text.secondary} />
            <Text style={styles.dismissText}>Swipe or tap to dismiss</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
      paddingTop: spacing.lg,
    },
    searchInput: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      paddingTop: spacing["2xl"] * 2,
      paddingHorizontal: spacing["2xl"],
    },
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accent.muted,
      borderWidth: 1,
      borderColor: colors.accent.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xl,
    },
    emptyTitle: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: 20,
    },
    suggestions: {
      marginTop: spacing["2xl"] * 1.5,
      alignItems: "center",
      width: "100%",
    },
    suggestionsLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.md,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.sm,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    chipPressed: {
      opacity: 0.6,
    },
    chipText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    dismissButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: "auto",
      paddingBottom: spacing["2xl"] * 2,
    },
    dismissPressed: {
      opacity: 0.5,
    },
    dismissText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
    },
  });

export default SearchScreen;
