import React, { useEffect } from "react";
import { StyleSheet, Image } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function AnimatedSplashScreen({
  onAnimationFinish,
}: {
  onAnimationFinish: () => void;
}) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(1.2, { duration: 1000 });
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

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.splashContainer, animatedStyle]}
    >
      <Image
        source={require("@/assets/images/frederick-logo.png")}
        style={styles.splashImage}
        resizeMode="contain"
      />
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
  splashImage: {
    width: "50%",
    height: "50%",
  },
});
