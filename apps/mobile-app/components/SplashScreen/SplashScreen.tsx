import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated";

export function AnimatedSplashScreen({
  onAnimationFinish,
}: {
  onAnimationFinish: () => void;
}) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const titleScale = useSharedValue(1);

  useEffect(() => {
    // Subtle pulse animation for the title
    titleScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      true,
    );

    // Main exit animation
    scale.value = withTiming(1.1, { duration: 1000 });
    opacity.value = withTiming(0, { duration: 1200 }, (isFinished) => {
      if (isFinished) {
        runOnJS(onAnimationFinish)();
      }
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: titleScale.value }],
    };
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.splashContainer, animatedStyle]}
    >
      <View style={styles.contentContainer}>
        <Animated.View style={[styles.titleContainer, titleAnimatedStyle]}>
          <Text style={styles.appTitle}>Realtime</Text>
          <Text style={styles.appTitle}>Markers</Text>
        </Animated.View>
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  appTitle: {
    fontSize: 36,
    fontWeight: "700",
    fontFamily: "SpaceMono",
    color: "#ffffff",
    letterSpacing: 1,
    lineHeight: 44,
  },
  loadingText: {
    fontSize: 16,
    color: "#888888",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginTop: 10,
  },
});
