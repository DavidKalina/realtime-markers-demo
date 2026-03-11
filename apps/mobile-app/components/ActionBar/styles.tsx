import { Platform, StyleSheet } from "react-native";
import { fontFamily, spacing, type Colors } from "@/theme";

export const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bottomBar: {
      height: 60,
      backgroundColor: colors.bg.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: colors.fixed.black,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    contentContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      paddingHorizontal: 8,
    },
    labeledActionButton: {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: 2,
      minWidth: spacing._50,
      flex: 1,
      height: 70,
    },
    disabledButton: {
      opacity: 0.5,
    },
    actionButtonLabel: {
      color: colors.text.primary,
      fontSize: 11,
      fontFamily: fontFamily.mono,
      marginTop: spacing.xs,
      textAlign: "center",
    },
    actionButtonIcon: {
      width: 22,
      height: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    badgeDot: {
      position: "absolute",
      top: -2,
      right: -4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent.primary,
    },
    actionButtonInner: {
      alignItems: "center",
      justifyContent: "center",
    },
    activeIndicator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accent.primary,
      marginTop: 2,
    },
  });
