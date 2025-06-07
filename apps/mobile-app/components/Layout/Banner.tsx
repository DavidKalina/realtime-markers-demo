import { COLORS } from "./ScreenLayout";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View, Text } from "react-native";
import Animated, {
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withSpring,
} from "react-native-reanimated";

interface BannerProps {
  emoji?: string;
  name: string;
  onBack: () => void;
  scrollY: SharedValue<number>;
  extendToStatusBar?: boolean;
}

export default function Banner({
  emoji,
  name,
  onBack,
  extendToStatusBar,
}: BannerProps) {
  const zoneBannerAnimatedStyle = useAnimatedStyle(() => ({
    paddingTop: extendToStatusBar ? 44 : 8,
    paddingBottom: 8,
    marginTop: extendToStatusBar ? -44 : 0,
  }));

  const floatX = useSharedValue(0);
  const floatY = useSharedValue(0);

  useEffect(() => {
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

  const backButtonScale = useSharedValue(1);
  const backButtonRotation = useSharedValue(0);

  const handleBackPress = () => {
    backButtonScale.value = withSequence(
      withSpring(0.9, { damping: 10 }),
      withSpring(1, { damping: 10 }),
    );
    backButtonRotation.value = withSequence(
      withTiming(-0.1, { duration: 100, easing: Easing.ease }),
      withTiming(0.1, { duration: 100, easing: Easing.ease }),
      withTiming(0, { duration: 100, easing: Easing.ease }),
    );
    onBack();
  };

  const backButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: backButtonScale.value },
      { rotate: `${backButtonRotation.value}rad` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.zoneBanner,
        zoneBannerAnimatedStyle,
        extendToStatusBar && styles.extendedBanner,
      ]}
      layout={LinearTransition.springify()}
    >
      <View style={styles.bannerContent}>
        <View style={styles.backButtonPlaceholder} />
        <Animated.View
          style={[styles.bannerBackButton, backButtonAnimatedStyle]}
        >
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButtonTouchable}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </Animated.View>
        <View style={styles.titleContainer}>
          <View style={styles.titleContent}>
            <Animated.View style={floatingEmojiStyle}>
              <Text style={styles.zoneBannerEmoji}>{emoji || "👥"}</Text>
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
    borderBottomColor: COLORS.divider,
    justifyContent: "center",
    paddingTop: 2,
    zIndex: 2,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  extendedBanner: {
    position: "relative",
    zIndex: 2,
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
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
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
