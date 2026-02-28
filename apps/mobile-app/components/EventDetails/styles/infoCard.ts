import { StyleSheet } from "react-native";
import { colors, spacing, fontSize, fontWeight, fontFamily } from "@/theme";

export const infoCardStyles = StyleSheet.create({
  infoCard: {},
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.md,
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
    color: colors.text.disabled,
    fontFamily: fontFamily.mono,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  infoCardContent: {},
});
