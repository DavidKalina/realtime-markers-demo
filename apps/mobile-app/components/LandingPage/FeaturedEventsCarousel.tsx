import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { EventType } from "@/types/types";
import EventListItem from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface FeaturedEventsCarouselProps {
  events: EventType[];
  isLoading?: boolean;
}

const { width: screenWidth } = Dimensions.get("window");
const ITEM_WIDTH = screenWidth * 0.85; // 85% of screen width
const ITEM_SPACING = 16;
const ITEM_MARGIN = (screenWidth - ITEM_WIDTH) / 2;

const FeaturedEventsCarousel: React.FC<FeaturedEventsCarouselProps> = ({
  events,
  isLoading = false,
}) => {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

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

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const newIndex = Math.round(
          event.nativeEvent.contentOffset.x / (ITEM_WIDTH + ITEM_SPACING),
        );
        if (newIndex !== currentIndex) {
          setCurrentIndex(newIndex);
        }
      },
    },
  );

  const scrollToIndex = useCallback((index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * (ITEM_WIDTH + ITEM_SPACING),
        animated: true,
      });
    }
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Featured Events</Text>
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            pagingEnabled={false}
            snapToInterval={ITEM_WIDTH + ITEM_SPACING}
            decelerationRate="fast"
          >
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.itemContainer, styles.loadingItem]}>
                <View style={styles.loadingContent} />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Featured Events</Text>

      <View style={styles.carouselContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          pagingEnabled={false}
          snapToInterval={ITEM_WIDTH + ITEM_SPACING}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.itemContainer}
              onPress={() => handleEventPress(event)}
              activeOpacity={0.9}
            >
              <View style={styles.cardContainer}>
                <EventListItem
                  {...event}
                  eventDate={new Date(event.eventDate)}
                  onPress={() => handleEventPress(event)}
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Pagination Indicators */}
      {events.length > 1 && (
        <View style={styles.paginationContainer}>
          {events.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.paginationDot,
                index === currentIndex && styles.paginationDotActive,
              ]}
              onPress={() => scrollToIndex(index)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 16,
    fontFamily: "Poppins-Regular",
  },
  carouselContainer: {
    position: "relative",
  },
  scrollContent: {
    paddingHorizontal: ITEM_MARGIN,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  cardContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
  },
  loadingItem: {
    opacity: 0.6,
  },
  loadingContent: {
    width: ITEM_WIDTH,
    height: 140,
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: "#007AFF",
    width: 24,
  },
});

export default FeaturedEventsCarousel;
