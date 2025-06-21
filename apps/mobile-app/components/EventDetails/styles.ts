import { StyleSheet, Dimensions } from "react-native";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

// Municipal-friendly color scheme
const MUNICIPAL_COLORS = {
  primary: "#1e40af", // Professional blue
  secondary: "#059669", // Municipal green
  accent: "#f59e0b", // Warm amber
  background: "#f8fafc", // Light gray background
  card: "#ffffff", // White cards
  text: "#1e293b", // Dark slate text
  textSecondary: "#64748b", // Medium gray
  border: "#e2e8f0", // Light border
  success: "#10b981", // Green for success states
  warning: "#f59e0b", // Amber for warnings
  error: "#ef4444", // Red for errors
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MUNICIPAL_COLORS.background,
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
    backgroundColor: MUNICIPAL_COLORS.card,
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
    fontFamily: "Poppins-Regular",
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
    backgroundColor: MUNICIPAL_COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: MUNICIPAL_COLORS.border,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: MUNICIPAL_COLORS.text,
    fontFamily: "Poppins-Regular",
    lineHeight: 36,
    marginBottom: 12,
  },
  eventEmojiContainer: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: MUNICIPAL_COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
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

  // Info Card Components
  infoCard: {
    backgroundColor: MUNICIPAL_COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: MUNICIPAL_COLORS.border,
    backgroundColor: MUNICIPAL_COLORS.background,
  },
  infoCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: MUNICIPAL_COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: MUNICIPAL_COLORS.text,
    fontFamily: "Poppins-Regular",
  },
  infoCardContent: {
    padding: 20,
  },

  // Detail Rows
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  detailText: {
    color: MUNICIPAL_COLORS.text,
    fontSize: 16,
    flex: 1,
    fontFamily: "Poppins-Regular",
    lineHeight: 24,
  },
  detailTextSecondary: {
    color: MUNICIPAL_COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    lineHeight: 20,
    marginTop: 4,
  },

  // Location Content
  locationContent: {
    flex: 1,
  },
  distanceText: {
    color: MUNICIPAL_COLORS.primary,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    marginTop: 4,
    fontWeight: "500",
  },

  // Description
  descriptionText: {
    fontSize: 16,
    color: MUNICIPAL_COLORS.text,
    lineHeight: 24,
    fontFamily: "Poppins-Regular",
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
    backgroundColor: MUNICIPAL_COLORS.primary + "15", // 15% opacity
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.primary + "30", // 30% opacity
  },
  categoryText: {
    color: MUNICIPAL_COLORS.primary,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    fontWeight: "500",
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
  },

  // Admin Section
  adminSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: MUNICIPAL_COLORS.text,
    fontFamily: "Poppins-Regular",
    marginBottom: 12,
  },
  adminActionsContainer: {
    flexDirection: "row",
    gap: 12,
  },

  // QR Code Section
  qrContent: {
    alignItems: "center",
    gap: 16,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrUrlContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: MUNICIPAL_COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
  },
  qrUrlLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MUNICIPAL_COLORS.primary,
    fontFamily: "Poppins-Regular",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  qrUrlText: {
    fontSize: 14,
    color: MUNICIPAL_COLORS.text,
    fontFamily: "Poppins-Regular",
    lineHeight: 18,
  },
  qrDescription: {
    color: MUNICIPAL_COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    lineHeight: 20,
  },

  // Discovered By Section
  discoveredByContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  discoveredByText: {
    fontSize: 16,
    color: MUNICIPAL_COLORS.text,
    fontFamily: "Poppins-Regular",
  },
  discoveredByName: {
    fontWeight: "600",
    color: MUNICIPAL_COLORS.primary,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    paddingTop: 50,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: windowWidth,
    height: windowHeight * 0.7,
  },

  // Dialog Styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContainer: {
    backgroundColor: MUNICIPAL_COLORS.card,
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: MUNICIPAL_COLORS.text,
    marginBottom: 12,
    fontFamily: "Poppins-Regular",
  },
  dialogText: {
    fontSize: 16,
    color: MUNICIPAL_COLORS.textSecondary,
    marginBottom: 24,
    fontFamily: "Poppins-Regular",
    lineHeight: 22,
  },
  dialogButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  dialogButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  dialogButtonCancel: {
    backgroundColor: MUNICIPAL_COLORS.background,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
  },
  dialogButtonDelete: {
    backgroundColor: MUNICIPAL_COLORS.error,
  },
  dialogButtonTextCancel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
    color: MUNICIPAL_COLORS.text,
  },
  dialogButtonTextDelete: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
    color: "#ffffff",
  },

  // Legacy styles for compatibility
  loadingContainer: {
    flex: 1,
    backgroundColor: MUNICIPAL_COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: MUNICIPAL_COLORS.textSecondary,
    marginTop: 16,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
  },
  shareIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: MUNICIPAL_COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
  },
  imageWrapper: {
    position: "relative",
    width: "100%",
  },
  imageContainer: {
    width: "100%",
    height: 240,
    backgroundColor: MUNICIPAL_COLORS.card,
    overflow: "hidden",
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    backgroundColor: MUNICIPAL_COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: MUNICIPAL_COLORS.text,
    fontSize: 16,
    opacity: 0.6,
    fontFamily: "Poppins-Regular",
  },
  emojiWrapper: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emoji: {
    fontSize: 24,
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    paddingRight: 72,
    borderBottomWidth: 1,
    borderBottomColor: MUNICIPAL_COLORS.border,
    position: "relative",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: MUNICIPAL_COLORS.text,
    flex: 1,
    fontFamily: "Poppins-Regular",
    lineHeight: 32,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: MUNICIPAL_COLORS.card,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
  },
  savedButton: {
    backgroundColor: MUNICIPAL_COLORS.primary,
    borderColor: "transparent",
  },
  saveButtonText: {
    color: MUNICIPAL_COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Poppins-Regular",
  },
  savedButtonText: {
    color: MUNICIPAL_COLORS.background,
  },
  detailsContainer: {
    padding: 20,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  locationContainer: {
    flex: 1,
  },
  descriptionContainer: {
    flex: 1,
    marginLeft: 0,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: MUNICIPAL_COLORS.text,
    marginBottom: 12,
    fontFamily: "Poppins-Regular",
    flexDirection: "row",
    alignItems: "center",
  },
  viewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  viewText: {
    color: "#ffffff",
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  adminButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  adminButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
  },
  categoriesSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  categoriesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  categoriesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: MUNICIPAL_COLORS.text,
    marginLeft: 8,
    fontFamily: "Poppins-Regular",
    letterSpacing: 0.3,
  },
  qrSection: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  qrIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: MUNICIPAL_COLORS.text,
    fontFamily: "Poppins-Regular",
    flex: 1,
    letterSpacing: 0.5,
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  qrButtonText: {
    color: MUNICIPAL_COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  discoveredBySection: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: MUNICIPAL_COLORS.text,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  discoveredByHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  discoveredByIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  discoveredByTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: MUNICIPAL_COLORS.textSecondary,
    fontFamily: "Poppins-Regular",
    letterSpacing: 0.5,
  },
  mapPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  mapPreviewContainer: {
    width: "100%",
    height: 200,
    backgroundColor: MUNICIPAL_COLORS.card,
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
  },
  mapPreviewFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: MUNICIPAL_COLORS.border,
    flexDirection: "row",
    justifyContent: "center",
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: MUNICIPAL_COLORS.primary + "10",
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.primary + "20",
  },
  directionsButtonDisabled: {
    backgroundColor: MUNICIPAL_COLORS.border,
    borderColor: MUNICIPAL_COLORS.border,
  },
  directionsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: MUNICIPAL_COLORS.primary,
    fontFamily: "Poppins-Regular",
  },
  directionsButtonTextDisabled: {
    color: "#9ca3af",
  },
  mapCardFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: MUNICIPAL_COLORS.border,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: MUNICIPAL_COLORS.primary,
    zIndex: 1000,
  },
  markerEmoji: {
    fontSize: 24,
  },
  privateEventImageOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: MUNICIPAL_COLORS.background,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  privateEventImage: {
    width: "100%",
    height: "100%",
  },
  privateEventImageError: {
    color: MUNICIPAL_COLORS.text,
    fontSize: 12,
    textAlign: "center",
    padding: 8,
  },
  recurringDetailsContainer: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: MUNICIPAL_COLORS.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
  },
  recurringDetailsContent: {
    flex: 1,
    marginLeft: 12,
  },
});
