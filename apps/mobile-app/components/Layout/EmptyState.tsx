import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Button from "./Button";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  fontFamily,
  spring,
} from "@/theme";

interface EmptyStateAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "warning" | "error";
}

export interface EmptyStateProps {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: EmptyStateAction;
  variant?: "default" | "error";
  animated?: boolean;
}

const STAGGER_DELAY = 80;

const EmptyState: React.FC<EmptyStateProps> = ({
  emoji,
  title,
  subtitle,
  action,
  variant = "default",
  animated = true,
}) => {
  const isError = variant === "error";

  const circleStyle = [
    styles.circle,
    {
      backgroundColor: isError
        ? colors.status.error.bg
        : colors.accent.muted,
      borderColor: isError
        ? colors.status.error.text
        : colors.accent.border,
    },
  ];

  const entering = (index: number) =>
    animated
      ? FadeInDown.springify()
          .damping(spring.bouncy.damping)
          .stiffness(spring.bouncy.stiffness)
          .mass(spring.bouncy.mass)
          .delay(index * STAGGER_DELAY)
      : undefined;

  const Wrapper = animated ? Animated.View : View;

  return (
    <View style={styles.container}>
      <Wrapper entering={entering(0)} style={styles.element}>
        <View style={circleStyle}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
      </Wrapper>

      <Wrapper entering={entering(1)} style={styles.element}>
        <Text style={styles.title}>{title}</Text>
      </Wrapper>

      {subtitle && (
        <Wrapper entering={entering(2)} style={styles.element}>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </Wrapper>
      )}

      {action && (
        <Wrapper entering={entering(subtitle ? 3 : 2)} style={styles.element}>
          <Button
            title={action.label}
            onPress={action.onPress}
            variant={action.variant || "outline"}
            size="small"
          />
        </Wrapper>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["3xl"],
  },
  element: {
    alignItems: "center",
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  emoji: {
    fontSize: 44,
  },
  title: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
});

export default EmptyState;
