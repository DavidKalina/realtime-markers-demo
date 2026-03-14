import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const MARQUEE_SPEED = 30; // px per second
const MARQUEE_GAP = 48; // px gap between the two copies

interface MarqueeTextProps {
  text: string;
  style: TextStyle;
}

/**
 * Single-line text that scrolls horizontally in a loop when it overflows.
 * Falls back to a truncated static text when it fits.
 */
const MarqueeText: React.FC<MarqueeTextProps> = ({ text, style }) => {
  const [titleWidth, setTitleWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useSharedValue(0);

  const needsMarquee =
    titleWidth > 0 && containerWidth > 0 && titleWidth > containerWidth;

  const cycleWidth = titleWidth + MARQUEE_GAP;

  useEffect(() => {
    translateX.value = 0;
    if (!needsMarquee) return;

    const cycleDurationMs = (cycleWidth / MARQUEE_SPEED) * 1000;

    translateX.value = withRepeat(
      withTiming(-cycleWidth, {
        duration: cycleDurationMs,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => cancelAnimation(translateX);
  }, [needsMarquee, cycleWidth]);

  const marqueeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={styles.clip}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Off-screen measurement — no width constraint */}
      <Text
        style={[style, styles.measure]}
        onLayout={(e) =>
          setTitleWidth(Math.ceil(e.nativeEvent.layout.width))
        }
      >
        {text}
      </Text>

      {needsMarquee ? (
        <Animated.View style={[styles.ticker, marqueeStyle]}>
          <Text style={style}>{text}</Text>
          <Text style={[style, { marginLeft: MARQUEE_GAP }]}>{text}</Text>
        </Animated.View>
      ) : (
        <Text style={style} numberOfLines={1}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  clip: {
    width: "100%",
    overflow: "hidden",
  },
  measure: {
    position: "absolute",
    opacity: 0,
    top: -9999,
    width: 99999,
  },
  ticker: {
    flexDirection: "row",
    flexWrap: "nowrap",
  },
});

export default React.memo(MarqueeText);
