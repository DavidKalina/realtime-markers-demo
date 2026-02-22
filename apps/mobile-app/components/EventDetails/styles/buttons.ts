import { StyleSheet } from "react-native";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";

export const buttonStyles = StyleSheet.create({
  // Actions Section
  actionsSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing._14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowColor: colors.fixed.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },

  // Admin Section
  adminSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["2xl"],
  },
  adminActionsContainer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  adminButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  adminButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },

  // Save Button
  saveButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing._10,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  savedButton: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.fixed.transparent,
  },
  saveButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
  },
  savedButtonText: {
    color: colors.bg.primary,
  },

  // Share Icon Button
  shareIconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  // Directions Button
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.accent.primary + "10",
    borderWidth: 1,
    borderColor: colors.accent.primary + "20",
  },
  directionsButtonDisabled: {
    backgroundColor: colors.border.default,
    borderColor: colors.border.default,
  },
  directionsButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
  },
  directionsButtonTextDisabled: {
    color: "#9ca3af",
  },
});
