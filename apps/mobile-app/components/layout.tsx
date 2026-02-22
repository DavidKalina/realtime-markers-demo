// styles/layout.ts - Update to container and innerContainer
import { StyleSheet } from "react-native";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";

export const layout = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%", // Add full width
  },
  innerContainer: {
    position: "absolute",
    bottom: 0, // Remove bottom margin to anchor at bottom
    width: "100%", // Full width
    alignSelf: "center",
    zIndex: 10000000,
  },
  card: {
    backgroundColor: colors.bg.primary,
    borderRadius: 0, // Remove the border radius at top
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    shadowColor: colors.fixed.black,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: "hidden",
    flexDirection: "column",
    height: 150,
  },
  row: {
    flexDirection: "row",
    flex: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },

  fixedActionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    flex: 1,
  },
  scrollViewContainer: {
    flex: 1,
    height: 50,
  },
  scrollableActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: spacing.xs,
  },
  detailRow: {
    marginBottom: spacing.lg,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing._14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius._10,
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: colors.fixed.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  primaryButton: {
    backgroundColor: colors.connection.dot, // Keep this blue for directions
  },
  secondaryButton: {
    backgroundColor: "#4a4a4a",
    borderWidth: 1,
    borderColor: "#5a5a5a",
  },
  primaryButtonText: {
    color: colors.fixed.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  eventEmoji: {
    fontSize: fontSize["2xl"],
    marginRight: spacing.md,
  },
  icon: {
    marginRight: spacing.xs,
  },
});
