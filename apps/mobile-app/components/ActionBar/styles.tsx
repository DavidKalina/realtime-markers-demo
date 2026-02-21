// styles/action.ts - Updated with more refined button selection styles
import { Platform, StyleSheet } from "react-native";
import {
  colors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
  radius,
} from "@/theme";

export const styles = StyleSheet.create({
  bottomBar: {
    height: 60,
    backgroundColor: colors.bg.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4, // Reduced padding
    borderTopWidth: 1,
    borderTopColor: colors.border.medium, // Updated for better contrast on teal
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: colors.fixed.black,
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.2, // Increased shadow opacity for better visibility on teal
        shadowRadius: 4, // Updated to match StatusBar shadow radius
      },
      android: {
        elevation: 3, // Updated to match StatusBar elevation
      },
    }),
  },
  chevronContainer: {
    width: 48, // Fixed width for chevron buttons
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    marginHorizontal: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fixed.transparent,
    ...Platform.select({
      ios: {
        shadowColor: colors.fixed.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  labeledActionButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm, // Increased padding for better touch targets
    paddingHorizontal: 2, // Reduced horizontal padding to reduce gaps
    minWidth: spacing._50, // Set minimum width for consistent spacing
    flex: 1, // Allow buttons to take equal space
    height: 70, // Set explicit height to ensure labels have space
  },
  actionButtonLabel: {
    color: "rgba(255, 255, 255, 0.9)", // Semi-transparent white for inactive state
    fontSize: 11, // Increased font size for better visibility
    fontFamily: fontFamily.mono, // Changed to SemiBold
    marginTop: spacing.xs, // Increased margin for better spacing
    textAlign: "center",
  },
  activeActionButtonLabel: {
    color: colors.accent.primary,
    fontWeight: fontWeight.semibold, // Make active labels slightly bolder
  },
  actionButtonIcon: {
    width: 22, // Slightly smaller icon container for labeled buttons
    height: 22, // Slightly smaller icon container for labeled buttons
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  actionButtonText: {
    fontFamily: fontFamily.mono,
    color: colors.text.primary, // White text for teal background
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  detailActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.medium,
    paddingTop: spacing.sm,
  },
  detailActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing._14,
    borderRadius: radius._10, // Slightly more refined corners
    backgroundColor: colors.bg.primary, // Match Cluster Events view background
    borderWidth: 1,
    borderColor: colors.border.medium,
    ...Platform.select({
      ios: {
        shadowColor: colors.fixed.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  detailActionText: {
    color: colors.text.primary, // Light text for dark theme
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    marginLeft: spacing._6,
  },
  iconSmall: {
    marginRight: 2,
  },
});
