import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowLeft, ArrowRight, Check } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useAuth } from "@/contexts/AuthContext";

const { width } = Dimensions.get("window");

// Onboarding screen data
const ONBOARDING_STEPS = [
  {
    id: "1",
    title: "Discover Events",
    description: "Find events happening near you with our powerful search and map features.",
    emoji: "🔍",
  },
  {
    id: "2",
    title: "Stay Updated",
    description:
      "Save events and get notified about changes or updates to your favorite happenings.",
    emoji: "🔔",
  },
  {
    id: "3",
    title: "Share with Friends",
    description: "Easily share events with friends and family via SMS or social media.",
    emoji: "📱",
  },
  {
    id: "4",
    title: "Get There",
    description: "Use built-in navigation to find your way to any event with just a tap.",
    emoji: "🗺️",
  },
];

const Onboarding = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { completeOnboarding, isAuthenticated } = useAuth();

  // Function to handle navigation to next slide
  const goToNextSlide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      // Complete onboarding
      handleComplete();
    }
  };

  // Function to handle navigation to previous slide
  const goToPrevSlide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Function to handle skipping onboarding
  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Mark onboarding as complete
    await completeOnboarding();

    // Navigate based on authentication status
    if (isAuthenticated) {
      router.replace("/");
    } else {
      router.replace("/login");
    }
  };

  // Function to handle completing onboarding
  const handleComplete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Mark onboarding as complete
    await completeOnboarding();

    // Navigate based on authentication status
    if (isAuthenticated) {
      router.replace("/");
    } else {
      router.replace("/login");
    }
  };

  // Handle viewport change (swiping)
  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  // Render individual onboarding slide
  const renderSlide = ({ item }: any) => {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.slide}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </Animated.View>
    );
  };

  // Render indicator dots
  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {ONBOARDING_STEPS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index === currentIndex ? "#93c5fd" : "#4a4a4a" },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header with Skip button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_STEPS}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />

      {/* Dots indicator */}
      {renderDots()}

      {/* Navigation buttons */}
      <View style={styles.buttonsContainer}>
        {/* Back button - only show if not on first slide */}
        {currentIndex > 0 ? (
          <TouchableOpacity style={styles.navButton} onPress={goToPrevSlide}>
            <ArrowLeft size={22} color="#93c5fd" />
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyNavButton} />
        )}

        {/* Next/Complete button */}
        <TouchableOpacity style={styles.primaryButton} onPress={goToNextSlide}>
          {currentIndex === ONBOARDING_STEPS.length - 1 ? (
            <>
              <Text style={styles.primaryButtonText}>Get Started</Text>
              <Check size={20} color="#f8f9fa" style={{ marginLeft: 8 }} />
            </>
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Next</Text>
              <ArrowRight size={20} color="#f8f9fa" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skipButton: {
    padding: 8,
  },
  skipButtonText: {
    color: "#93c5fd",
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  slide: {
    width,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 72,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 6,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 20,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#3a3a3a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  emptyNavButton: {
    width: 50,
    height: 50,
    opacity: 0,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#93c5fd",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  primaryButtonText: {
    color: "#f8f9fa",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
});

export default Onboarding;
