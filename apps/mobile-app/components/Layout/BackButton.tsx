import { ArrowLeft } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useColors, spacing, spring, type Colors } from "@/theme";

interface BackButtonProps {
  onPress: () => void;
}

export default function BackButton({ onPress }: BackButtonProps) {
  const router = useRouter();
  const canGoBack = router.canGoBack();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backButtonScale = useSharedValue(1);
  const backButtonRotation = useSharedValue(0);

  const backButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: backButtonScale.value },
      { rotate: `${backButtonRotation.value}rad` },
    ],
  }));

  if (!canGoBack) return null;

  const handlePress = () => {
    backButtonScale.value = withSequence(
      withSpring(0.9, spring.soft),
      withSpring(1, spring.soft),
    );
    backButtonRotation.value = withSequence(
      withTiming(-0.1, { duration: 100, easing: Easing.ease }),
      withTiming(0.1, { duration: 100, easing: Easing.ease }),
      withTiming(0, { duration: 100, easing: Easing.ease }),
    );
    onPress();
  };

  return (
    <Animated.View style={[styles.bannerBackButton, backButtonAnimatedStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        style={styles.backButtonTouchable}
        activeOpacity={0.7}
      >
        <ArrowLeft size={20} color={colors.fixed.white} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  bannerBackButton: {
    position: "absolute",
    left: spacing.lg,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonTouchable: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.medium,
    shadowColor: colors.fixed.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});
