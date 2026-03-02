import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, spacing, fontSize, fontFamily, duration } from "@/theme";

export interface EndOfListProps {
  message?: string;
  animated?: boolean;
}

const EndOfList: React.FC<EndOfListProps> = ({
  message = "You're all caught up",
  animated = true,
}) => {
  const Wrapper = animated ? Animated.View : View;
  const entering = animated ? FadeIn.duration(duration.normal) : undefined;

  return (
    <Wrapper entering={entering} style={styles.container}>
      <View style={styles.row}>
        <View style={styles.line} />
        <Text style={styles.text}>{message}</Text>
        <View style={styles.line} />
      </View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing["3xl"],
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
  },
  text: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    color: colors.text.disabled,
  },
});

export default EndOfList;
