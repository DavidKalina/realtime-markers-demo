import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { useColors, fontSize, fontFamily, type Colors } from "@/theme";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

const TITLE = "Sidequests";
const CHAR_STAGGER = 60;
const INITIAL_DELAY = 500;

const AnimatedChar: React.FC<{
  char: string;
  index: number;
  style: Record<string, unknown>;
}> = React.memo(({ char, index, style }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    const delay = INITIAL_DELAY + index * CHAR_STAGGER;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {char}
    </Animated.Text>
  );
});

const AppHeader = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {TITLE.split("").map((char, i) => (
          <AnimatedChar key={i} char={char} index={i} style={styles.text} />
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      width: width,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      alignSelf: "center",
    },
    titleRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    text: {
      fontSize: 42,
      fontFamily: fontFamily.display,
      letterSpacing: 1,
      color: colors.fixed.white,
      zIndex: 10,
      textAlign: "center",
      textShadowColor: "rgba(77, 171, 247, 0.6)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    subtext: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      color: colors.fixed.white,
      zIndex: 10,
    },
  });

export default AppHeader;
