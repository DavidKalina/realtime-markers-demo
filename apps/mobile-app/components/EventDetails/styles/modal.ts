import { StyleSheet, Dimensions } from "react-native";
import {
  type Colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
} from "@/theme";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

export const createModalStyles = (colors: Colors) =>
  StyleSheet.create({
    // Modal Styles
    modalContainer: {
      flex: 1,
      backgroundColor: colors.overlay.heavy,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "flex-end",
      padding: spacing.lg,
      paddingTop: spacing._50,
      backgroundColor: colors.overlay.light,
      zIndex: 10,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.border.medium,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border.accent,
    },
    modalContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    fullImage: {
      width: windowWidth,
      height: windowHeight * 0.7,
    },

    // Dialog Styles
    dialogOverlay: {
      flex: 1,
      backgroundColor: colors.overlay.light,
      justifyContent: "center",
      alignItems: "center",
    },
    dialogContainer: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      padding: spacing["2xl"],
      width: "85%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.border.default,
      shadowColor: colors.fixed.black,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 10,
    },
    dialogTitle: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      marginBottom: spacing.md,
      fontFamily: fontFamily.mono,
    },
    dialogText: {
      fontSize: fontSize.md,
      color: colors.text.secondary,
      marginBottom: spacing["2xl"],
      fontFamily: fontFamily.mono,
      lineHeight: lineHeight.relaxed,
    },
    dialogButtons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.md,
    },
    dialogButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.sm,
      minWidth: 80,
      alignItems: "center",
    },
    dialogButtonCancel: {
      backgroundColor: colors.bg.primary,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    dialogButtonDelete: {
      backgroundColor: colors.status.error.bg,
    },
    dialogButtonTextCancel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    dialogButtonTextDelete: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.fixed.white,
    },
  });
