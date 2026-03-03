import { colors, spacing } from "@/theme";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Camera } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const PlusButton: React.FC = () => {
  const scale = useSharedValue(1);
  const router = useRouter();

  const navigate = useCallback(() => {
    router.push("/scan");
  }, [router]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withTiming(1, { duration: 100 }, () => {
        scheduleOnRN(navigate);
      }),
    );
  }, [navigate, scale]);

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
        <Camera size={22} color={colors.action.rsvp} />
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
