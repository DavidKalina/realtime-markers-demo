import React from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator } from "react-native";
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

export type ProcessingStage = "captured" | "uploading" | "success" | null;

interface ProcessingOverlayProps {
  isVisible: boolean;
  stage: ProcessingStage;
  capturedImageUri: string | null;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  isVisible,
  stage,
  capturedImageUri,
}) => {
  if (!isVisible) return null;

  return (
    <Animated.View
      style={styles.processingOverlay}
      entering={FadeIn.duration(300)}
    >
      {/* Background Image */}
      {capturedImageUri && (
        <Image
          source={{ uri: capturedImageUri }}
          style={styles.processingBackgroundImage}
          resizeMode="cover"
        />
      )}
      {/* Dark scrim over the image */}
      <View style={styles.processingDarkLayer} />
      {/* Centered content based on processing stage */}
      <View style={styles.processingCenterContent}>
        {stage === "captured" && (
          <>
            <Text style={styles.processingTitle}>Image Captured</Text>
            <Text style={styles.processingMessage}>
              Preparing to analyze your document...
            </Text>
            <ActivityIndicator
              size="large"
              color={colors.accent.primary}
              style={styles.spinnerTop}
            />
          </>
        )}
        {stage === "uploading" && (
          <>
            <ActivityIndicator
              size="large"
              color={colors.accent.primary}
              style={styles.spinnerBottom}
            />
            <Text style={styles.processingTitle}>Processing Document</Text>
            <Text style={styles.processingMessage}>
              Analyzing your document with AI...
            </Text>
          </>
        )}
        {stage === "success" && (
          <>
            <View style={styles.successIcon}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.processingTitle}>Success</Text>
            <Text style={styles.processingMessage}>
              Document processed successfully.
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  processingBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  processingDarkLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.scrim,
  },
  processingCenterContent: {
    width: "80%",
    maxWidth: 300,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  processingTitle: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  processingMessage: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
  },
  spinnerTop: {
    marginTop: spacing.xl,
  },
  spinnerBottom: {
    marginBottom: spacing.xl,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.status.success.bg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  successCheck: {
    color: colors.fixed.white,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
});
