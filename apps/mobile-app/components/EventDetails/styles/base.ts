import { StyleSheet } from "react-native";
import {
  colors,
  spacing,
  radius,
  shadows,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
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
    paddingTop: spacing["2xl"],
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  eventTitle: {
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.display,
    marginBottom: spacing.md,
  },
  eventEmojiContainer: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  eventEmoji: {
    fontSize: fontSize["2xl"],
  },

  // Details Section
  detailsSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing["2xl"],
  },

  // Detail Rows
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  detailText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    flex: 1,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.loose,
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
  distanceText: {
    color: colors.accent.primary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    marginTop: spacing.xs,
    fontWeight: fontWeight.medium,
  },

  // Description
  descriptionText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    lineHeight: lineHeight.loose,
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
    gap: spacing.sm,
  },
  categoryTag: {
    backgroundColor: colors.accent.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing._6,
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  categoryText: {
    color: colors.accent.primary,
    fontSize: fontSize.sm,
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
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
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
