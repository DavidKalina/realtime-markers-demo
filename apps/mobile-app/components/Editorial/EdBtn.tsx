import React from "react";
import {
  Pressable,
  Text,
  ViewStyle,
  StyleProp,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { edColors, edFont, edRadius, edShadows } from "@/theme/editorial";

type EdBtnVariant = "primary" | "secondary" | "ghost";

interface EdBtnProps {
  label: string;
  onPress?: () => void;
  variant?: EdBtnVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EdBtn({
  label,
  onPress,
  variant = "secondary",
  disabled,
  loading,
  style,
}: EdBtnProps) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const textColor = isPrimary ? edColors.paper : edColors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        !isPrimary && !isGhost && styles.secondary,
        isGhost && styles.ghost,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: edRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primary: {
    backgroundColor: edColors.ink,
    ...edShadows.primaryBtn,
  },
  secondary: {
    backgroundColor: edColors.paperHi,
    borderWidth: 1,
    borderColor: edColors.rule,
  },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: {
    fontFamily: edFont.sansSemibold,
    fontSize: 15,
    letterSpacing: -0.1,
  },
});
