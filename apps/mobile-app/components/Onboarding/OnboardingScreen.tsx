import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  type Colors,
} from "@/theme";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { OnboardingPage } from "./OnboardingPage";
import { createOnboardingPages } from "./onboardingData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 24;
const SPRING_CONFIG = { damping: 32, stiffness: 200 };

export const OnboardingScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const onboardingPages = useMemo(
    () => createOnboardingPages(colors),
    [colors],
  );
  const pageCount = onboardingPages.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const { completeOnboarding } = useOnboarding();
  const router = useRouter();

  const scrollOffset = useSharedValue(0);

  const handleComplete = useCallback(async () => {
    await completeOnboarding();
    router.replace("/");
  }, [completeOnboarding, router]);

  const goToPage = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, pageCount - 1));
      scrollOffset.value = withSpring(clamped * SCREEN_WIDTH, SPRING_CONFIG);
      setActiveIndex(clamped);
    },
    [scrollOffset],
  );

  const handleNext = useCallback(() => {
    if (activeIndex < pageCount - 1) {
      goToPage(activeIndex + 1);
    } else {
      handleComplete();
    }
  }, [activeIndex, goToPage, handleComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const updateActiveIndex = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      const base = activeIndex * SCREEN_WIDTH;
      const next = base - e.translationX;
      // Clamp with rubber-band effect at edges
      const maxOffset = (pageCount - 1) * SCREEN_WIDTH;
      if (next < 0) {
        scrollOffset.value = next * 0.3;
      } else if (next > maxOffset) {
        scrollOffset.value = maxOffset + (next - maxOffset) * 0.3;
      } else {
        scrollOffset.value = next;
      }
    })
    .onEnd((e) => {
      const delta = -e.translationX;
      let targetIndex = activeIndex;

      if (delta > SWIPE_THRESHOLD && activeIndex < pageCount - 1) {
        targetIndex = activeIndex + 1;
      } else if (delta < -SWIPE_THRESHOLD && activeIndex > 0) {
        targetIndex = activeIndex - 1;
      }

      scrollOffset.value = withSpring(
        targetIndex * SCREEN_WIDTH,
        SPRING_CONFIG,
      );
      runOnJS(updateActiveIndex)(targetIndex);
    });

  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollOffset.value }],
  }));

  const isLastPage = activeIndex === pageCount - 1;
  const isFirstPage = activeIndex === 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.pager, pagerStyle]}>
          {onboardingPages.map((page, index) => (
            <OnboardingPage
              key={page.id}
              page={page}
              index={index}
              scrollOffset={scrollOffset}
              isActive={index === activeIndex}
            />
          ))}
        </Animated.View>
      </GestureDetector>

      <View style={styles.footer}>
        {/* Skip button */}
        <Animated.View style={styles.skipContainer}>
          {!isLastPage ? (
            <Animated.Text
              style={styles.skipText}
              onPress={handleSkip}
              suppressHighlighting={false}
            >
              Skip
            </Animated.Text>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </Animated.View>

        {/* Dot indicator */}
        <View style={styles.dotsContainer}>
          {onboardingPages.map((_, index) => (
            <Dot key={index} index={index} scrollOffset={scrollOffset} />
          ))}
        </View>

        {/* Next / Let's Go button */}
        <Animated.View>
          <Animated.Text
            style={[styles.nextButton, isLastPage && styles.nextButtonLast]}
            onPress={isLastPage ? handleComplete : handleNext}
            suppressHighlighting={false}
          >
            {isFirstPage ? "Get Started" : isLastPage ? "Let's Go" : "Next"}
          </Animated.Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

interface DotProps {
  index: number;
  scrollOffset: SharedValue<number>;
}

const Dot: React.FC<DotProps> = ({ index, scrollOffset }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dotStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const width = interpolate(
      scrollOffset.value,
      inputRange,
      [DOT_SIZE, DOT_ACTIVE_WIDTH, DOT_SIZE],
      "clamp",
    );

    const opacity = interpolate(
      scrollOffset.value,
      inputRange,
      [0.3, 1, 0.3],
      "clamp",
    );

    const backgroundColor = interpolateColor(scrollOffset.value, inputRange, [
      colors.border.accent,
      colors.accent.primary,
      colors.border.accent,
    ]);

    return {
      width,
      opacity,
      backgroundColor,
    };
  });

  return <Animated.View style={[styles.dot, dotStyle]} />;
};

const TOTAL_PAGES = 7;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    pager: {
      flex: 1,
      flexDirection: "row",
      width: SCREEN_WIDTH * TOTAL_PAGES,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      paddingTop: spacing._10,
    },
    skipContainer: {
      minWidth: 80,
    },
    skipPlaceholder: {
      minWidth: 80,
    },
    skipText: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    dotsContainer: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    dot: {
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
    },
    nextButton: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      backgroundColor: colors.accent.muted,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      overflow: "hidden",
      textAlign: "center",
      minWidth: 80,
    },
    nextButtonLast: {
      backgroundColor: colors.accent.primary,
      borderColor: colors.accent.primary,
      color: colors.bg.primary,
    },
  });
