// EventDetailsView.tsx
import * as Haptics from "expo-haptics";
import { ArrowLeft, Navigation, Share2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { styles } from "./styles";
import { EventType } from "./types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiClient from "../../services/ApiClient"; // Adjust the import path as needed

interface EventDetailsViewProps {
  isVisible: boolean;
  eventId: string; // Changed from event object to eventId
  onClose: () => void;
  onShare: () => void;
  onGetDirections: () => void;
}

export const EventDetailsView: React.FC<EventDetailsViewProps> = ({
  isVisible,
  eventId,
  onClose,
  onShare,
  onGetDirections,
}) => {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch event details when the component becomes visible
  useEffect(() => {
    let isMounted = true;

    const fetchEventDetails = async () => {
      if (!isVisible || !eventId) return;

      setLoading(true);
      setError(null);

      try {
        const eventData = await apiClient.getEventById(eventId);
        if (isMounted) {
          setEvent(eventData);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`
          );
          console.error("Error fetching event details:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEventDetails();

    return () => {
      isMounted = false;
    };
  }, [isVisible, eventId]);

  // Calculate appropriate spacing based on device size
  const bottomSpacing = () => {
    // Base spacing
    let spacing = Math.max(20, insets.bottom);

    // Add additional spacing on taller devices
    if (height > 800) {
      spacing += 20;
    }

    // Calculate spacing as a percentage of screen height for consistent feel
    const dynamicSpacing = height * 0.05; // 5% of screen height

    return Math.max(spacing, dynamicSpacing);
  };

  // Calculate the assistant width based on screen size
  const assistantWidth = () => {
    // For smaller devices, use more width
    if (width < 375) {
      return "95%";
    }

    // For larger devices, use less width
    if (width > 428) {
      return "85%";
    }

    // Default
    return "90%";
  };

  // Animation values
  const animationProgress = useSharedValue(0);

  useEffect(() => {
    // Trigger haptic feedback when opening
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    animationProgress.value = withTiming(isVisible ? 1 : 0, {
      duration: 350, // Slightly longer for a more polished feel
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isVisible]);

  // Animated styles
  const detailsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      transform: [
        { translateY: (1 - animationProgress.value) * 50 },
        { scale: 0.9 + animationProgress.value * 0.1 }, // Start slightly smaller and scale up
      ],
    };
  });

  // Format the event time
  const formatDate = (timeString: string) => {
    return timeString;
  };

  // Handle close button
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Status badge component
  const StatusBadge = () => (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>VERIFIED</Text>
    </View>
  );

  // Don't render if not visible and animation is complete
  if (!isVisible && animationProgress.value === 0) {
    return null;
  }

  // Render loading state
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4287f5" />
          <Text style={styles.loadingText}>Loading event details...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setEvent(null);
              setError(null);
              setLoading(true);
              apiClient
                .getEventById(eventId)
                .then((data) => setEvent(data))
                .catch((err) =>
                  setError(
                    `Failed to load event details: ${
                      err instanceof Error ? err.message : "Unknown error"
                    }`
                  )
                )
                .finally(() => setLoading(false));
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!event) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No event details available</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollView}>
        <Animated.View
          style={styles.detailsCard}
          entering={SlideInUp.delay(100).springify().damping(15)}
        >
          <View style={styles.eventHeader}>
            <View style={styles.eventTitleContainer}>
              <Text style={styles.emoji}>{event.emoji}</Text>
              <Text style={styles.eventTitle}>{event.title}</Text>
            </View>
            <StatusBadge />
          </View>

          <View style={styles.detailsContainer}>
            <Animated.View style={styles.detailRow} entering={FadeIn.delay(200).duration(400)}>
              <Text style={styles.label}>Date & Time</Text>
              <Text style={styles.value}>{formatDate(event.time)}</Text>
            </Animated.View>

            <Animated.View style={styles.detailRow} entering={FadeIn.delay(250).duration(400)}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{event.location}</Text>
            </Animated.View>

            <Animated.View style={styles.detailRow} entering={FadeIn.delay(300).duration(400)}>
              <Text style={styles.label}>Distance</Text>
              <Text style={styles.value}>{event.distance}</Text>
            </Animated.View>

            <Animated.View style={styles.detailRow} entering={FadeIn.delay(350).duration(400)}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.value}>{event.description}</Text>
            </Animated.View>

            {event.categories && event.categories.length > 0 && (
              <Animated.View style={styles.detailRow} entering={FadeIn.delay(400).duration(400)}>
                <Text style={styles.label}>Categories</Text>
                <View style={styles.categoriesContainer}>
                  {event.categories.map((category, index) => (
                    <View key={index} style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{category}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container]}>
      <Animated.View style={[styles.detailsScreenContainer, detailsAnimatedStyle]}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={handleClose}>
            <ArrowLeft size={22} color="#f8f9fa" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Details</Text>
        </View>

        {renderContent()}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onShare}
            disabled={!event}
          >
            <Share2 size={16} color="#f8f9fa" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={onGetDirections}
            disabled={!event}
          >
            <Navigation size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Directions</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};
