import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, spacing, spring } from "@/theme";

const PlusButton: React.FC = () => {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    // Cancel any ongoing animations before starting new ones
    cancelAnimation(scale);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.92, spring.snappy);
  }, [scale]);

  // Reset scale after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      scale.value = withSpring(1, spring.snappy);
    }, 100);

    return () => clearTimeout(timer);
  }, [scale]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(scale);
    };
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <Plus size={20} color={colors.accent.primary} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing._6,
    paddingVertical: spacing._6,
    backgroundColor: colors.bg.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border.medium,
    shadowColor: colors.fixed.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 44,
    minHeight: 44,
  },
});

export default React.memo(PlusButton);
