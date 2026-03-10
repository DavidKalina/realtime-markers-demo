import { StyleSheet } from "react-native";
import {
  type Colors,
  fontSize,
  fontFamily,
  fontWeight,
  lineHeight,
  radius,
  shadows,
  spacing,
} from "@/theme";

export const createBaseStyles = (colors: Colors) =>
  StyleSheet.create({
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

    // ── Hero (itinerary-style header) ──
    hero: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xs,
      gap: spacing.md,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 28,
    },
    heroLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 2,
    },
    heroLabelPill: {
      backgroundColor: "rgba(147, 197, 253, 0.1)",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    heroLabelText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: "#93c5fd",
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    heroDot: {
      fontSize: 11,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
    },
    heroDate: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    heroSummary: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    statChip: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statChipValue: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    vibePill: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    vibeText: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      textTransform: "lowercase",
      letterSpacing: 0.5,
    },

    // ── Divider ──
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.lg,
      marginHorizontal: spacing.xl,
    },

    // Details Section
    detailsSection: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
      paddingTop: spacing.sm,
    },

    // Detail Rows
    detailRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    detailText: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      flex: 1,
      fontFamily: fontFamily.mono,
      lineHeight: lineHeight.relaxed,
    },
    detailTextSecondary: {
      color: colors.text.detail,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      lineHeight: lineHeight.relaxed,
      marginTop: spacing.xs,
    },

    // Location Row (tappable card — minimal like MarkerInfoHUD)
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    locationContent: {
      flex: 1,
    },
    locationAddress: {
      color: colors.text.primary,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.snug,
    },
    locationDistance: {
      color: colors.text.detail,
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      marginTop: 2,
    },
    chevronText: {
      fontSize: fontSize.xl,
      color: colors.text.detail,
      marginLeft: spacing.xs,
    },

    // Description
    descriptionText: {
      fontSize: fontSize.md,
      color: colors.text.primary,
      lineHeight: lineHeight.loose,
      fontFamily: fontFamily.mono,
    },

    // Highlights List
    highlightsList: {
      gap: spacing._6,
    },
    highlightItem: {
      fontSize: fontSize.sm,
      color: colors.text.primary,
      lineHeight: lineHeight.relaxed,
      fontFamily: fontFamily.mono,
    },
    highlightBullet: {
      color: colors.accent.primary,
      fontWeight: fontWeight.bold,
      fontSize: fontSize.sm,
    },

    // Recurring Details
    recurringDetails: {
      gap: spacing.sm,
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
      color: colors.text.detail,
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
      color: colors.text.detail,
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
      color: colors.text.detail,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
    },
  });
