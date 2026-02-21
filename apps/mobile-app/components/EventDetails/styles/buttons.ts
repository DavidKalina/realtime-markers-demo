import { StyleSheet } from "react-native";
import { COLORS } from "../../Layout/ScreenLayout";

export const buttonStyles = StyleSheet.create({
  // Actions Section
  actionsSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  // Admin Section
  adminSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  adminActionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  adminButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  adminButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  // Save Button
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  savedButton: {
    backgroundColor: COLORS.accent,
    borderColor: "transparent",
  },
  saveButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  savedButtonText: {
    color: COLORS.background,
  },

  // Share Icon Button
  shareIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.cardBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  // Directions Button
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent + "10",
    borderWidth: 1,
    borderColor: COLORS.accent + "20",
  },
  directionsButtonDisabled: {
    backgroundColor: COLORS.divider,
    borderColor: COLORS.divider,
  },
  directionsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.accent,
    fontFamily: "SpaceMono",
  },
  directionsButtonTextDisabled: {
    color: "#9ca3af",
  },
});
