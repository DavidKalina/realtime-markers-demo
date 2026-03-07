import { StyleSheet } from "react-native";
import {
  type Colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";

export const createButtonStyles = (colors: Colors) =>
  StyleSheet.create({
    // Actions Section
    actionsSection: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    actionButtonsContainer: {
      flexDirection: "row",
      gap: spacing.md,
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
  });
