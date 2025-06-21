import React, { useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, {
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import BackButton from "./BackButton";

// Updated color scheme to match register/login screens
const newColors = {
  background: "#00697A",
  text: "#FFFFFF",
  accent: "#FDB813",
  cardBackground: "#FFFFFF",
  cardText: "#000000",
  cardTextSecondary: "#6c757d",
  buttonBackground: "#FFFFFF",
  buttonText: "#00697A",
  buttonBorder: "#DDDDDD",
  inputBackground: "#F5F5F5",
  errorBackground: "#FFCDD2",
  errorText: "#B71C1C",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
  activityIndicator: "#00697A",
};

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
        <BackButton onPress={onBack} />
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
    backgroundColor: newColors.background, // Updated to teal background
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)", // Updated for better contrast on teal
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
    color: newColors.text, // Updated to white text for teal background
    fontSize: 22,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 0.4,
    lineHeight: 26,
    height: 26,
    textAlignVertical: "center",
  },
});
