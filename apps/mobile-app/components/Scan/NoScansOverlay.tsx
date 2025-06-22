import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { COLORS } from "../Layout/ScreenLayout";

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
          <Feather name="alert-triangle" size={32} color={COLORS.warningText} />
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
    padding: 20,
    zIndex: 100,
  },
  noScansContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  noScansIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.warningBackground,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  noScansTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Poppins-Regular",
    marginBottom: 8,
    textAlign: "center",
  },
  noScansMessage: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
  },
  dismissButton: {
    backgroundColor: COLORS.buttonBackground,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  dismissButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
  },
});
