import { ViewStyle, StyleSheet, TextStyle } from "react-native";

// Unified color theme matching ClusterEventsView
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
  success: {
    background: "rgba(64, 192, 87, 0.12)",
    border: "rgba(64, 192, 87, 0.2)",
    text: "#40c057"
  },
  error: {
    background: "rgba(249, 117, 131, 0.1)",
    border: "rgba(249, 117, 131, 0.2)",
    text: "#f97583"
  },
  shadow: "rgba(0, 0, 0, 0.5)",
};

// Inline styles
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  // Content area
  contentArea: {
    flex: 1,
  },

  // List styles
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Filter card styles
  filterCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 12,
    marginHorizontal: 0,
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: "column",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    gap: 12,
  },

  filterIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  filterTitleContainer: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },

  filterName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 4,
  },

  filterQuery: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    lineHeight: 18,
  },

  filterDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },

  filterDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  filterDetailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },

  activeCheckmark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  filterEmoji: {
    fontSize: 18,
    textAlign: "center",
    includeFontPadding: false,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 12,
  },

  filterActions: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },

  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },

  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    color: COLORS.textPrimary,
  },

  applyButton: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  applyButtonText: {
    color: COLORS.accent,
  },

  editButton: {
    backgroundColor: COLORS.buttonBackground,
    borderColor: COLORS.buttonBorder,
  },

  editButtonText: {
    color: COLORS.textPrimary,
  },

  deleteButton: {
    backgroundColor: COLORS.error.background,
    borderColor: COLORS.error.border,
  },

  deleteButtonText: {
    color: COLORS.error.text,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontSize: 16,
    marginTop: 16,
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.error.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.error.border,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },

  retryButton: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  retryButtonText: {
    color: COLORS.accent,
    fontFamily: "SpaceMono",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },

  createButton: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  createButtonText: {
    color: COLORS.accent,
    fontFamily: "SpaceMono",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Bottom action bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    padding: 16,
  },

  clearButton: {
    backgroundColor: COLORS.buttonBackground,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  clearButtonText: {
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalScrollContent: {
    padding: 16,
    paddingBottom: 100, // Extra padding at the bottom for keyboard
  },

  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },

  keyboardDismissButton: {
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  keyboardDismissText: {
    color: "#adb5bd",
    fontSize: 13,
    fontFamily: "SpaceMono",
  },

  // Form styles
  formGroup: {
    marginBottom: 20,
  },

  formLabel: {
    fontSize: 14,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "rgba(66, 66, 66, 0.6)",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  datePresetsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },

  datePresetsLabel: {
    fontSize: 12,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },

  datePresetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  datePresetButton: {
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  } as ViewStyle,

  datePresetButtonActive: {
    backgroundColor: "rgba(147, 197, 253, 0.2)",
    borderColor: "rgba(147, 197, 253, 0.4)",
  } as ViewStyle,

  datePresetText: {
    color: "#93c5fd",
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  } as TextStyle,

  datePresetTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  } as TextStyle,

  radiusInput: {
    flex: 1,
  },

  locationLabel: {
    fontSize: 12,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },

  helperText: {
    fontSize: 12,
    color: "#adb5bd",
    marginTop: 4,
    fontStyle: "italic",
    lineHeight: 16,
  },

  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(249, 117, 131, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },

  cancelButtonText: {
    color: "#f97583",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },

  saveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },


  saveButtonDisabled: {
    backgroundColor: "#3a3a3a",
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#f8f9fa",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    width: "90%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 1001,
  },

  // Form styles
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },

  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  dateInput: {
    flex: 1,
    minWidth: 120,
  },

  dateRangeSeparator: {
    color: "#adb5bd",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },

  locationButton: {
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    borderColor: "rgba(147, 197, 253, 0.2)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    alignItems: "center",
  },

  locationButtonText: {
    color: "#93c5fd",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },

  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#93c5fd",
    borderRadius: 8,
    padding: 12,
    width: "100%",
  },
});
