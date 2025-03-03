// ActionView.tsx
import * as Haptics from "expo-haptics";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { Dimensions, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles"; // Using the centralized styles

interface ActionViewProps {
  isVisible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: number | string; // number in pixels or string percentage like '50%'
}

export const ActionView: React.FC<ActionViewProps> = ({
  isVisible,
  title,
  onClose,
  children,
  footer,
  maxHeight,
}) => {
  const { height: screenHeight } = Dimensions.get("window");
  const insets = useSafeAreaInsets(); // Get the safe area insets

  // Calculate available height by subtracting top and bottom insets
  // When used in a partial overlay context (like over a map), consider remaining height
  // You may need to adjust this based on your specific layout
  const availableHeight = screenHeight * 0.75; // Approximate space for the modal (75% of screen)

  // Animation value
  const animationProgress = useSharedValue(0);

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
  const viewAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      transform: [
        { translateY: (1 - animationProgress.value) * 50 },
        { scale: 0.9 + animationProgress.value * 0.1 },
      ],
    };
  });

  // Calculate the maxHeight dynamically with insets taken into account
  const getMaxHeight = () => {
    if (typeof maxHeight === "string") {
      // Handle percentage values
      if (maxHeight.endsWith("%")) {
        const percentage = parseFloat(maxHeight) / 100;
        return availableHeight * percentage;
      }
      return maxHeight;
    }

    // Default height calculation if not provided or if it's a number
    // Use availableHeight instead of screenHeight for calculations
    // When used over a map or other content, we want to take most of the remaining space
    // while still leaving some room for context
    return maxHeight || Math.min(availableHeight * 0.95, Math.max(300, availableHeight * 0.95));
  };

  // Handle close button
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Don't render if not visible and animation is complete
  if (!isVisible && animationProgress.value === 0) {
    return null;
  }

  return (
    <View style={[styles.actionContainer, { paddingBottom: insets.bottom }]}>
      <Animated.View
        style={[styles.actionModal, viewAnimatedStyle, { maxHeight: getMaxHeight() as number }]}
      >
        <View style={styles.actionHeader}>
          <TouchableOpacity style={styles.actionBackButton} onPress={handleClose}>
            <ArrowLeft size={22} color="#f8f9fa" />
          </TouchableOpacity>
          <Text style={styles.actionTitle}>{title}</Text>
        </View>

        {/* ScrollView to make content scrollable */}
        <ScrollView
          style={styles.actionScrollView}
          contentContainerStyle={{ paddingBottom: 20 }} // Add some bottom padding
          showsVerticalScrollIndicator={true} // Explicitly show scrollbar
        >
          {children}
        </ScrollView>

        {footer && <View style={styles.actionFooter}>{footer}</View>}
      </Animated.View>
    </View>
  );
};
