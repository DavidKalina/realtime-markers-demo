import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontFamily,
  lineHeight,
} from "@/theme";

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  animated?: boolean;
  delay?: number;
}

const DetailItem: React.FC<DetailItemProps> = ({
  icon,
  label,
  value,
  children,
  style,
  animated = false,
  delay = 0,
}) => {
  const Container = animated ? Animated.View : View;

  return (
    <Container
      style={[styles.container, style]}
      entering={
        animated ? FadeInDown.duration(600).delay(delay).springify() : undefined
      }
    >
      <View style={styles.iconContainer}>{icon}</View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {children || (value && <Text style={styles.value}>{value}</Text>)}
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: spacing["4xl"],
    height: spacing["4xl"],
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
  },
});

export default DetailItem;
