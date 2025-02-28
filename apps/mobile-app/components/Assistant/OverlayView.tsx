// OverlayView.tsx
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { X, MapPin, Clock, Tag, Navigation, Share2, Info } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { styles } from "./styles";
import { EventType } from "./types";

interface OverlayViewProps {
  isVisible: boolean;
  event: EventType;
  overlayType: "details" | "share" | "search" | "camera" | "directions" | null;
  onClose: () => void;
}

export const OverlayView: React.FC<OverlayViewProps> = ({
  isVisible,
  event,
  overlayType,
  onClose,
}) => {
  // Animation values
  const animationProgress = useSharedValue(0);

  // Trigger animation when visibility changes
  useEffect(() => {
    // Trigger haptic feedback when opening
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    animationProgress.value = withTiming(isVisible ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isVisible]);

  // Animated styles
  const overlayAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      transform: [
        {
          translateY: interpolate(animationProgress.value, [0, 1], [50, 0], Extrapolate.CLAMP),
        },
      ],
    };
  });

  // Handle close button
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Render content based on overlay type
  const renderContent = () => {
    switch (overlayType) {
      case "details":
        return renderDetailsContent();
      case "share":
        return <Text style={styles.overlayText}>Share functionality would go here</Text>;
      case "search":
        return <Text style={styles.overlayText}>Search functionality would go here</Text>;
      case "camera":
        return <Text style={styles.overlayText}>Camera functionality would go here</Text>;
      case "directions":
        return <Text style={styles.overlayText}>Directions functionality would go here</Text>;
      default:
        return null;
    }
  };

  const renderDetailsContent = () => {
    return (
      <>
        <View style={styles.overlayHeader}>
          <Info size={18} color="#fcd34d" style={{ marginRight: 8 }} />
          <Text style={styles.overlayTitle}>{event.title}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={16} color="#fcd34d" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.overlayScrollContent}>
          <Text style={styles.detailDescription}>{event.description}</Text>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.detailRow}>
              <MapPin size={16} color="#fcd34d" style={styles.icon} />
              <Text style={styles.detailText}>{event.location}</Text>
            </View>
            <Text style={styles.distanceText}>{event.distance}</Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <View style={styles.detailRow}>
              <Clock size={16} color="#fcd34d" style={styles.icon} />
              <Text style={styles.detailText}>{event.time}</Text>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.categoriesContainer}>
              {event.categories.map((category, i) => (
                <View key={i} style={styles.categoryBadge}>
                  <Tag size={10} color="#fcd34d" style={styles.iconSmall} />
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.overlayActions}>
            <TouchableOpacity style={styles.overlayActionButton}>
              <Navigation size={16} color="#fcd34d" />
              <Text style={styles.overlayActionText}>Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.overlayActionButton}>
              <Share2 size={16} color="#fcd34d" />
              <Text style={styles.overlayActionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </>
    );
  };

  // Don't render anything if not visible and animation is complete
  if (!isVisible && animationProgress.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlayContainer, overlayAnimatedStyle]}>
      <View style={styles.overlayContent}>{renderContent()}</View>
    </Animated.View>
  );
};
