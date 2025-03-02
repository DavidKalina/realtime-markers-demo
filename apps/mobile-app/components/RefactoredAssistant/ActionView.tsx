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
import { styles } from "./styles"; // Using the centralized styles

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

  // Create the content container style as a variable, not a function
  const contentContainerStyle = React.useMemo(() => {
    // If maxHeight is a string (like '50%'), use it directly
    if (maxHeight && typeof maxHeight === "string") {
      return StyleSheet.create({
        container: {
          maxHeight: maxHeight as any, // Type assertion to handle string percentages
        },
      }).container;
    }

    // Calculate default height if not provided or if it's a number
    const heightValue = (maxHeight as number) || Math.min(Math.max(screenHeight * 0.45, 250), 450);
    return StyleSheet.create({
      container: {
        maxHeight: heightValue,
      },
    }).container;
  }, [maxHeight, screenHeight]);

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
    <View style={styles.actionContainer}>
      <Animated.View style={[styles.actionModal, viewAnimatedStyle]}>
        <View style={styles.actionHeader}>
          <TouchableOpacity style={styles.actionBackButton} onPress={handleClose}>
            <ArrowLeft size={22} color="#f8f9fa" />
          </TouchableOpacity>
          <Text style={styles.actionTitle}>{title}</Text>
        </View>

        <ScrollView style={styles.actionScrollView} contentContainerStyle={contentContainerStyle}>
          {children}
        </ScrollView>

        {footer && <View style={styles.actionFooter}>{footer}</View>}
      </Animated.View>
    </View>
  );
};
