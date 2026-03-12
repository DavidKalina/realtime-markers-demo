import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  useColors,
  spacing,
  fontSize,
  fontFamily,
  duration,
  type Colors,
} from "@/theme";

export interface EndOfListProps {
  message?: string;
  animated?: boolean;
}

const EndOfList: React.FC<EndOfListProps> = ({
  message = "You're all caught up",
  animated = true,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
