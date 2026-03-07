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

    // Hero Section — full-width title, info row beneath
    titleSection: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    eventTitle: {
      fontSize: fontSize["2xl"],
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
      lineHeight: lineHeight.heading,
    },
    heroInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    heroInfoItem: {
      fontSize: fontSize.sm,
      color: colors.text.detail,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
    },
    heroInfoSep: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
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

    // Categories — DNA bar
    dnaBar: {
      flexDirection: "row",
      height: 6,
      borderRadius: 3,
      overflow: "hidden",
      gap: 2,
    },
    dnaSegment: {
      height: "100%",
    },
    dnaSegmentFirst: {
      borderTopLeftRadius: 3,
      borderBottomLeftRadius: 3,
    },
    dnaSegmentLast: {
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
    },
    dnaLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    dnaLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing._6,
    },
    dnaLegendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dnaLegendText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.detail,
    },
    categoryDnaSection: {
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    categoryDnaLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    categoryPieRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    categoryPieLegend: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
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
