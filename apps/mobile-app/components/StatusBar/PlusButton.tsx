import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
  const router = useRouter();

  const handlePressIn = useCallback(() => {
    cancelAnimation(scale);
    scale.value = withSpring(0.85, spring.snappy);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    cancelAnimation(scale);
    scale.value = withSpring(1, spring.bouncy);
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/scan");
  }, [router]);

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
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        <Plus size={22} color={colors.accent.primary} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    minWidth: 52,
    minHeight: 52,
  },
});

export default React.memo(PlusButton);
