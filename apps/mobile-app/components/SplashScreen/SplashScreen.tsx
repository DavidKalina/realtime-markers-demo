import React, { useEffect } from "react";
import { StyleSheet, Image, Text, View } from "react-native";
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
  const logoScale = useSharedValue(1);

  useEffect(() => {
    // Start with a subtle pulse animation for the logo
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1, // Infinite repeat
      true, // Reverse
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

  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: logoScale.value }],
    };
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.splashContainer, animatedStyle]}
    >
      <View style={styles.contentContainer}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Image
            source={require("@/assets/images/frederick-logo.png")}
            style={styles.splashImage}
            resizeMode="contain"
          />
        </Animated.View>
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    marginBottom: 20,
  },
  splashImage: {
    width: 200,
    height: 200,
  },
  loadingText: {
    fontSize: 16,
    color: "#00697A",
    fontWeight: "500",
    marginTop: 10,
  },
});
