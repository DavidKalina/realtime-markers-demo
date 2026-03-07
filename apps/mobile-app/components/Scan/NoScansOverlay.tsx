import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  useColors,
  type Colors,
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
}

export const NoScansOverlay: React.FC<NoScansOverlayProps> = ({
  isVisible,
  onDismiss,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={styles.noScansOverlay}
      entering={FadeIn.duration(300)}
    >
      <View style={styles.noScansContent}>
        <View style={styles.noScansIconContainer}>
          <AlertTriangle size={32} color={colors.status.warning.text} />
        </View>
        <Text style={styles.noScansTitle}>Scan Limit Reached</Text>
        <Text style={styles.noScansMessage}>
          You've used all your scans for this week. Your scans will reset next
          week — check back soon!
        </Text>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissButtonText}>Got It</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    noScansOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay.heavy,
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
