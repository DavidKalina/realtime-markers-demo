import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";

interface LoadingOverlayProps {
  message?: string;
  subMessage?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = React.memo(
  ({
    message = "Finding your location...",
    subMessage = "We'll show you events nearby",
  }) => {
    return (
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.accent.primary}
            style={styles.loadingSpinner}
          />
          <Text style={styles.loadingText}>{message}</Text>
          <Text style={styles.loadingSubtext}>{subMessage}</Text>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loadingContainer: {
    alignItems: "center",
    padding: spacing["2xl"],
    borderRadius: radius["2xl"],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingSpinner: {
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.sm,
  },
  loadingSubtext: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});
