import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  spacing,
} from "@/theme";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { OnboardingPageData } from "./onboardingData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingPageProps {
  page: OnboardingPageData;
  index: number;
  scrollOffset: SharedValue<number>;
  isActive: boolean;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({
  page,
  index,
  scrollOffset,
  isActive,
}) => {
  const Illustration = page.illustration;

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(20);

  useEffect(() => {
    if (isActive) {
      titleOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      titleTranslateY.value = withDelay(
        200,
        withSpring(0, { damping: 15, stiffness: 150 }),
      );
      bodyOpacity.value = withDelay(350, withTiming(1, { duration: 400 }));
      bodyTranslateY.value = withDelay(
        350,
        withSpring(0, { damping: 15, stiffness: 150 }),
      );
    } else {
      titleOpacity.value = withTiming(0, { duration: 200 });
      titleTranslateY.value = 20;
      bodyOpacity.value = withTiming(0, { duration: 200 });
      bodyTranslateY.value = 20;
    }
  }, [isActive, titleOpacity, titleTranslateY, bodyOpacity, bodyTranslateY]);

  // Parallax: illustration moves at 0.7x speed
  const illustrationStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const translateX = interpolate(scrollOffset.value, inputRange, [
      SCREEN_WIDTH * 0.3,
      0,
      -SCREEN_WIDTH * 0.3,
    ]);
    return {
      transform: [{ translateX }],
    };
  });

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslateY.value }],
  }));

  return (
    <View style={styles.page}>
      <View style={styles.topSpacer} />

      <Animated.View style={[styles.illustrationContainer, illustrationStyle]}>
        <Illustration active={isActive} />
      </Animated.View>

      <View style={styles.textContainer}>
        <Animated.Text style={[styles.title, titleStyle]}>
          {page.title}
        </Animated.Text>
        <Animated.Text style={[styles.body, bodyStyle]}>
          {page.body}
        </Animated.Text>
      </View>

      <View style={styles.bottomSpacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing["3xl"],
  },
  topSpacer: {
    flex: 1,
  },
  illustrationContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  body: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: lineHeight.relaxed,
  },
  bottomSpacer: {
    flex: 1.2,
  },
});
