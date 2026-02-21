import { StyleSheet } from "react-native";
import { COLORS } from "../../Layout/ScreenLayout";

export const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },

  // Hero Section
  heroSection: {
    position: "relative",
    width: "100%",
  },
  heroImageContainer: {
    width: "100%",
    height: 280,
    backgroundColor: COLORS.cardBackground,
    overflow: "hidden",
  },
  eventBadgeOverlay: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
  },
  eventBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  engagementOverlay: {
    position: "absolute",
    bottom: 20,
    right: 20,
    zIndex: 10,
  },

  // Title Section
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    lineHeight: 36,
    marginBottom: 12,
  },
  eventEmojiContainer: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  eventEmoji: {
    fontSize: 24,
  },

  // Details Section
  detailsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
  },

  // Detail Rows
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  detailText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    flex: 1,
    fontFamily: "SpaceMono",
    lineHeight: 24,
  },
  detailTextSecondary: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginTop: 4,
  },

  // Location Content
  locationContent: {
    flex: 1,
  },
  distanceText: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginTop: 4,
    fontWeight: "500",
  },

  // Description
  descriptionText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    lineHeight: 24,
    fontFamily: "SpaceMono",
  },

  // Recurring Details
  recurringDetails: {
    gap: 8,
  },

  // Categories
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryTag: {
    backgroundColor: COLORS.accent + "15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accent + "30",
  },
  categoryText: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },

  // Discovered By Section
  discoveredByContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  discoveredByText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
  discoveredByName: {
    fontWeight: "600",
    color: COLORS.accent,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 16,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },

  // Error
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },

  // Save Count
  saveCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saveCountText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
});
