import { COLORS } from "./ScreenLayout";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  Extrapolate,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
} from "react-native-reanimated";

interface GroupBannerProps {
  emoji?: string;
  name: string;
  description?: string;
  onBack: () => void;
  scrollY: Animated.SharedValue<number>;
}

export default function GroupBanner({
  emoji,
  name,
  description,
  onBack,
  scrollY,
}: GroupBannerProps) {
  const zoneBannerAnimatedStyle = useAnimatedStyle(() => {
    const bannerPaddingVertical = interpolate(
      scrollY.value,
      [0, 100],
      [24, 12],
      Extrapolate.CLAMP,
    );
    return {
      paddingBottom: bannerPaddingVertical,
    };
  });

  const animatedBannerEmojiStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, 100], [48, 32], Extrapolate.CLAMP),
    marginBottom: interpolate(
      scrollY.value,
      [0, 100],
      [12, 6],
      Extrapolate.CLAMP,
    ),
  }));

  const animatedBannerNameStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, 100], [28, 22], Extrapolate.CLAMP),
    marginBottom: interpolate(
      scrollY.value,
      [0, 100],
      [8, 4],
      Extrapolate.CLAMP,
    ),
  }));

  const animatedBannerDescriptionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolate.CLAMP),
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [0, 50],
          [1, 0.95],
          Extrapolate.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[styles.zoneBanner, zoneBannerAnimatedStyle]}
      layout={LinearTransition.springify()}
    >
      <TouchableOpacity onPress={onBack} style={styles.bannerBackButton}>
        <ArrowLeft size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Animated.Text style={[styles.zoneBannerEmoji, animatedBannerEmojiStyle]}>
        {emoji || "👥"}
      </Animated.Text>
      <Animated.Text style={[styles.zoneBannerName, animatedBannerNameStyle]}>
        {name}
      </Animated.Text>
      <Animated.Text
        style={[styles.zoneBannerDescription, animatedBannerDescriptionStyle]}
      >
        {description || "Join this group to connect with like-minded people"}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zoneBanner: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  bannerBackButton: {
    position: "absolute",
    top: 48,
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
  },
  zoneBannerEmoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "SpaceMono",
  },
  zoneBannerName: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  zoneBannerDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0.3,
    paddingHorizontal: 10,
  },
});
