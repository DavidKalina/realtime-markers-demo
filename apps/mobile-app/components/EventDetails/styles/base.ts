import { StyleSheet } from "react-native";
import {
  colors,
  fontSize,
  fontFamily,
  fontWeight,
  lineHeight,
  radius,
  shadows,
  spacing,
} from "@/theme";

export const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  contentContainer: {
    paddingBottom: spacing["2xl"],
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.md,
  },

  // Hero Section
  heroSection: {
    position: "relative",
    width: "100%",
  },
  heroImageContainer: {
    width: "100%",
    height: 280,
    backgroundColor: colors.bg.card,
    overflow: "hidden",
  },
  eventBadgeOverlay: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
    zIndex: 10,
  },
  eventBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing._6,
    borderRadius: radius["2xl"],
    ...shadows.md,
  },
  eventBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
  },
  engagementOverlay: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.xl,
    zIndex: 10,
  },

  // Title Section
  titleSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  eventTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.heading,
    flex: 1,
  },
  eventEmojiContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    justifyContent: "center",
    alignItems: "center",
  },
  eventEmoji: {
    fontSize: fontSize.xl,
  },

  // Details Section
  detailsSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["2xl"],
  },

  // Section divider
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.medium,
  },

  // Detail Rows
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  detailText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    flex: 1,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
  },
  detailTextSecondary: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
    marginTop: spacing.xs,
  },

  // Location Content
  locationContent: {
    flex: 1,
  },
  locationAddress: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
  },
  distanceText: {
    color: colors.accent.primary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    marginTop: 2,
    fontWeight: fontWeight.medium,
  },

  // Description
  descriptionText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: lineHeight.relaxed,
    fontFamily: fontFamily.mono,
  },

  // Recurring Details
  recurringDetails: {
    gap: spacing.sm,
  },

  // Categories
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing._6,
  },
  categoryTag: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  categoryText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
  },

  // Section Title
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.md,
  },

  // Discovered By Section
  discoveredByContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  discoveredByText: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
  },
  discoveredByName: {
    fontWeight: fontWeight.semibold,
    color: colors.accent.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.lg,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
  },

  // Error
  errorContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["2xl"],
  },
  errorText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing["2xl"],
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: colors.fixed.white,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },

  // Save Count
  saveCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  saveCountText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },
});
