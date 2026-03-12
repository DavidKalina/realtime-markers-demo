import { StyleSheet } from "react-native";
import { spacing, fontSize, fontWeight, fontFamily } from "@/theme";
import type { Colors } from "@/theme";

export const createInfoCardStyles = (colors: Colors) =>
  StyleSheet.create({
    infoCard: {},
    sectionDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
      paddingTop: spacing.lg,
      marginTop: spacing.xs,
    },
    infoCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    infoCardIcon: {
      marginRight: spacing._6,
    },
    infoCardTitle: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
    },
    infoCardContent: {},
  });
