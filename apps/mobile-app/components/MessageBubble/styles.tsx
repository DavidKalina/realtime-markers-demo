// styles/message.ts - Updated text alignment
import { StyleSheet } from "react-native";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
} from "@/theme";

export const styles = StyleSheet.create({
  messageBubble: {
    backgroundColor: colors.bg.cardAlt,
    borderRadius: radius.md,
    padding: 7,
    flex: 1,
    shadowColor: colors.fixed.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.relaxed,
    minHeight: spacing["5xl"],
    fontFamily: fontFamily.mono,
    textAlign: "left", // Changed from center to left for natural text streaming
  },
  transitionMessageText: {
    color: colors.status.success.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.relaxed,
    textAlign: "center", // Keep this centered since it's a status message
    fontFamily: fontFamily.mono,
  },

  // Rest of the message styles remain the same
  detailTitle: {
    color: colors.accent.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.sm,
  },
  detailDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  detailText: {
    color: colors.accent.primary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    marginLeft: spacing.xs,
  },
  interactiveDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    paddingVertical: spacing._6,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },
  detailActionIcon: {
    marginLeft: spacing.sm,
  },
  detailRow: {
    marginBottom: spacing.lg,
  },
  typingIndicator: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.disabled,
    marginLeft: 2,
    marginTop: -5,
    opacity: 0.8,
  },
  textWrapper: {
    flex: 1,
  },
  typingDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xs,
    backgroundColor: colors.text.disabled,
    marginHorizontal: 2,
  },
});
