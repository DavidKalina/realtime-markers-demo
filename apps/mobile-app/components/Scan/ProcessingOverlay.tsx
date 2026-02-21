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
      {/* Fullscreen dark overlay for contrast */}
      <View style={styles.processingDarkLayer} />
      {/* Centered content based on processing stage */}
      <View style={styles.processingCenterContent}>
        {stage === "captured" && (
          <>
            <Text style={styles.processingTitleStrong}>Image Captured!</Text>
            <Text style={styles.processingMessageStrong}>
              Your document has been captured successfully.
            </Text>
            <ActivityIndicator
              size="large"
              color={colors.accent.primary}
              style={{ marginTop: spacing["2xl"] }}
            />
          </>
        )}
        {stage === "uploading" && (
          <>
            <ActivityIndicator
              size="large"
              color={colors.accent.primary}
              style={{ marginBottom: spacing["2xl"] }}
            />
            <Text style={styles.processingTitleStrong}>
              Processing Document
            </Text>
            <Text style={styles.processingMessageStrong}>
              Please wait while we analyze your document...
            </Text>
          </>
        )}
        {stage === "success" && (
          <>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.processingTitleStrong}>Success!</Text>
            <Text style={styles.processingMessageStrong}>
              Your document has been processed successfully.
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
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  processingBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  processingDarkLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  processingCenterContent: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  processingTitleStrong: {
    color: colors.fixed.black,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  processingMessageStrong: {
    color: colors.bg.elevated,
    fontSize: fontSize.sm,
    textAlign: "center",
    fontFamily: fontFamily.mono,
    marginBottom: spacing["2xl"],
    lineHeight: lineHeight.normal,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
});
