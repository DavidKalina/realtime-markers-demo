import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
} from "@/theme";

interface NoScansOverlayProps {
  isVisible: boolean;
  onDismiss: () => void;
  onUpgrade: () => void;
}

export const NoScansOverlay: React.FC<NoScansOverlayProps> = ({
  isVisible,
  onDismiss,
  onUpgrade,
}) => {
  if (!isVisible) return null;

  return (
    <Animated.View
      style={styles.noScansOverlay}
      entering={FadeIn.duration(300)}
    >
      <View style={styles.noScansContent}>
        <View style={styles.noScansIconContainer}>
          <Feather
            name="alert-triangle"
            size={32}
            color={colors.status.warning.text}
          />
        </View>
        <Text style={styles.noScansTitle}>Scan Limit Reached</Text>
        <Text style={styles.noScansMessage}>
          You've used all your weekly scans. Upgrade to Pro for unlimited scans.
        </Text>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgrade}
          activeOpacity={0.7}
        >
          <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  noScansOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    zIndex: 100,
  },
  noScansContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    alignItems: "center",
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.status.warning.border,
  },
  noScansIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.status.warning.bg,
    borderWidth: 1,
    borderColor: colors.status.warning.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  noScansTitle: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  noScansMessage: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginBottom: spacing["2xl"],
    lineHeight: lineHeight.normal,
  },
  upgradeButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  upgradeButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  dismissButton: {
    backgroundColor: colors.border.subtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  dismissButtonText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },
});
