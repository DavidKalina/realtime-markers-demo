import { COLORS } from "./ScreenLayout";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View, Text } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

interface BannerProps {
  emoji?: string;
  name: string;
  onBack: () => void;
  scrollY: SharedValue<number>;
}

export default function Banner({ emoji, name, onBack, scrollY }: BannerProps) {
  const zoneBannerAnimatedStyle = useAnimatedStyle(() => {
    const bannerPaddingVertical = interpolate(
      scrollY.value,
      [0, 80],
      [8, 6],
      Extrapolation.CLAMP,
    );
    return {
      paddingBottom: bannerPaddingVertical,
    };
  });

  const animatedBannerEmojiStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(
      scrollY.value,
      [0, 80],
      [28, 22],
      Extrapolation.CLAMP,
    ),
  }));

  // Add floating animation values
  const floatX = useSharedValue(0);
  const floatY = useSharedValue(0);

  useEffect(() => {
    // More subtle floating animation
    floatX.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1.5, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    floatY.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const floatingEmojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: floatX.value }, { translateY: floatY.value }],
  }));

  return (
    <Animated.View
      style={[styles.zoneBanner, zoneBannerAnimatedStyle]}
      layout={LinearTransition.springify()}
    >
      <View style={styles.bannerContent}>
        <View style={styles.backButtonPlaceholder} />
        <TouchableOpacity onPress={onBack} style={styles.bannerBackButton}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <View style={styles.titleContent}>
            <Animated.View style={floatingEmojiStyle}>
              <Animated.Text
                style={[styles.zoneBannerEmoji, animatedBannerEmojiStyle]}
              >
                {emoji || "👥"}
              </Animated.Text>
            </Animated.View>
            <Text style={styles.zoneBannerName}>{name}</Text>
          </View>
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zoneBanner: {
    height: 90,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    paddingTop: 2,
  },
  bannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  bannerBackButton: {
    position: "absolute",
    left: 16,
    top: "50%",
    transform: [{ translateY: -20 }],
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 16,
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
  },
  titleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: "100%",
    paddingVertical: 2,
  },
  zoneBannerEmoji: {
    fontSize: 28,
    fontFamily: "SpaceMono",
    lineHeight: 32,
    height: 32,
    textAlignVertical: "center",
  },
  zoneBannerName: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 0.4,
    lineHeight: 26,
    height: 26,
    textAlignVertical: "center",
  },
});
