import useEventSearch from "@/hooks/useEventSearch";
import { useLocationStore } from "@/stores/useLocationStore";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Search as SearchIcon, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  Platform,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import {
  useAnimatedScrollHandler,
  useSharedValue
} from "react-native-reanimated";
import EventList from "../EventList/EventList";
import Input from "../Input/Input";
import Header from "../Layout/Header";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";

const SearchView = () => {
  const router = useRouter();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollY = useSharedValue(0);

  // Get stored markers from location store to show nearby events initially
  const storedMarkers = useLocationStore((state) => state.markers);

  // Use our custom hook
  const {
    searchQuery,
    setSearchQuery,
    eventResults,
    isLoading,
    isFetchingMore,
    error,
    hasSearched,
    searchEvents,
    handleLoadMore,
    clearSearch,
  } = useEventSearch({ initialMarkers: storedMarkers });

  const searchInputRef = useRef<TextInput>(null);

  // Simplify the search input handler
  const handleSearchInput = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearch = useCallback(() => {
    Keyboard.dismiss();
    searchEvents(true);
  }, [searchEvents]);

  // Memoize handlers
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    router.back();
  }, []);

  const handleClearSearch = useCallback(() => {
    Haptics.selectionAsync();
    clearSearch();
    searchInputRef.current?.focus();
  }, [clearSearch]);

  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Set up keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e: KeyboardEvent) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    // Auto-focus the search input when the screen opens
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 500);

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  return (
    <ScreenLayout>
      <Header
        title="Search Events"
        onBack={handleBack}
        rightIcon={<SearchIcon size={18} color="#93c5fd" />}
      />

      <View style={styles.contentArea}>
        {/* Enhanced Search Input */}
        <View style={styles.searchInputContainer}>
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
            autoFocus={true}
          />
        </View>

        {/* Main Content */}
        <EventList
          events={eventResults}
          isLoading={isLoading}
          isFetchingMore={isFetchingMore}
          error={error}
          hasSearched={hasSearched}
          onRefresh={() => searchEvents(true)}
          onLoadMore={handleLoadMore}
          onRetry={() => searchEvents(true)}
          emptyStateTitle="No results found"
          emptyStateDescription="We couldn't find any events matching your search. Try different keywords or browse nearby events."
          emptyStateIcon={<SearchIcon size={36} color={COLORS.accent} style={{ opacity: 0.6 }} />}
          showDistance={true}
          showChevron={true}
          keyboardHeight={keyboardHeight}
          keyboardVisible={keyboardVisible}
        />
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    paddingTop: 8,
  },
  searchInputContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  searchSpinnerContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
});

export default SearchView;
