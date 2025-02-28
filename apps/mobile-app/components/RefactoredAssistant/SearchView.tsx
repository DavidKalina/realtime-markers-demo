import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Platform,
  Dimensions,
  LayoutChangeEvent,
} from "react-native";
import { ArrowLeft, SearchIcon, X, Calendar, MapPin, Tag } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
  SlideInUp,
} from "react-native-reanimated";
import { styles } from "./styles";
import { EventType } from "./types";
import { eventSuggestions } from "./data";

interface SearchViewProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectEvent: (event: EventType) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ isVisible, onClose, onSelectEvent }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<EventType[]>(eventSuggestions);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [listHeight, setListHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const listRef = useRef<FlatList>(null);

  // Animation values
  const animationProgress = useSharedValue(0);

  // Filter categories derived from all event data
  const categories = Array.from(
    new Set(eventSuggestions.flatMap((event) => event.categories))
  ).sort();

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

    // Clean up listeners on unmount
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Trigger animation when visibility changes
  useEffect(() => {
    // Trigger haptic feedback when opening
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    animationProgress.value = withTiming(isVisible ? 1 : 0, {
      duration: 350,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isVisible]);

  // Animated styles
  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      transform: [
        { translateY: (1 - animationProgress.value) * 50 },
        { scale: 0.9 + animationProgress.value * 0.1 },
      ],
    };
  });

  // Filter events based on search and category filter
  useEffect(() => {
    const results = eventSuggestions.filter((event) => {
      const matchesSearch =
        searchQuery === "" ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        activeFilter === null ||
        event.categories.some((cat) => cat.toLowerCase() === activeFilter.toLowerCase());

      return matchesSearch && matchesFilter;
    });

    setFilteredEvents(results);
  }, [searchQuery, activeFilter]);

  // Handle back button
  const handleClose = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Handle select event
  const handleSelectEvent = (event: EventType) => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectEvent(event);
  };

  // Handle filter selection
  const toggleFilter = (filter: string) => {
    Haptics.selectionAsync();
    setActiveFilter(activeFilter === filter ? null : filter);
  };

  // Clear search query
  const clearSearch = () => {
    Haptics.selectionAsync();
    setSearchQuery("");
  };

  // Track the list container's height
  const handleListLayout = (e: LayoutChangeEvent) => {
    setListHeight(e.nativeEvent.layout.height);
  };

  // Track the actual content height
  const handleContentSizeChange = (width: number, height: number) => {
    setContentHeight(height);
  };

  // Don't render if not visible and animation is complete
  if (!isVisible && animationProgress.value === 0) {
    return null;
  }

  // Calculate if we need padding (only if content is less than the available space)
  const needsBottomPadding = contentHeight < listHeight;

  return (
    <Animated.View style={[styles.detailsScreenContainer, containerAnimatedStyle]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Events</Text>
      </View>

      <View style={styles.scrollView}>
        {/* Search Input */}
        <Animated.View
          style={styles.searchInputContainer}
          entering={SlideInUp.delay(100).springify().damping(15)}
        >
          <SearchIcon size={16} color="#4dabf7" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, venues, categories..."
            placeholderTextColor="#919191"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={16} color="#4dabf7" />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Filter Chips */}
        <Animated.View entering={SlideInUp.delay(150).springify().damping(15)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {categories.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, activeFilter === filter && styles.activeFilterChip]}
                onPress={() => toggleFilter(filter)}
              >
                <Tag
                  size={12}
                  color={activeFilter === filter ? "#fff" : "#4dabf7"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === filter && styles.activeFilterChipText,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Results Count */}
        <Animated.View entering={FadeIn.delay(200).duration(400)}>
          <Text style={styles.resultsText}>
            {filteredEvents.length} {filteredEvents.length === 1 ? "result" : "results"} found
          </Text>
        </Animated.View>

        {/* Results List */}
        <Animated.View
          style={styles.searchResultsContainer}
          entering={SlideInUp.delay(250).springify().damping(15)}
          onLayout={handleListLayout}
        >
          <FlatList
            ref={listRef}
            data={filteredEvents}
            keyExtractor={(item, index) => `event-${index}`}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeIn.delay(300 + index * 50).duration(300)}>
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => handleSelectEvent(item)}
                >
                  <Text style={styles.resultEmoji}>{item.emoji}</Text>
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle}>{item.title}</Text>
                    <View style={styles.resultDetailsRow}>
                      <Calendar size={12} color="#4dabf7" style={{ marginRight: 4 }} />
                      <Text style={styles.resultDetailText}>{item.time}</Text>
                      <MapPin size={12} color="#4dabf7" style={{ marginLeft: 8, marginRight: 4 }} />
                      <Text style={styles.resultDetailText}>{item.distance}</Text>
                    </View>
                    <View style={styles.resultCategoriesRow}>
                      {item.categories.map((category: any, catIndex: number) => (
                        <View key={catIndex} style={styles.resultCategoryChip}>
                          <Text style={styles.resultCategoryText}>{category}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.searchResultsList,
              // Apply keyboard padding only if needed
              needsBottomPadding &&
                keyboardVisible && {
                  paddingBottom: keyboardHeight,
                },
            ]}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={handleContentSizeChange}
            // If content is less than screen height, disable scrolling
            scrollEnabled={
              contentHeight > listHeight - (keyboardVisible ? keyboardHeight : 0) || keyboardVisible
            }
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
};
