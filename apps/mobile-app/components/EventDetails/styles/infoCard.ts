import { StyleSheet } from "react-native";
import { colors, spacing, fontWeight, fontFamily } from "@/theme";

export const infoCardStyles = StyleSheet.create({
  infoCard: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
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
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.text.disabled,
    fontFamily: fontFamily.mono,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoCardContent: {},
});
