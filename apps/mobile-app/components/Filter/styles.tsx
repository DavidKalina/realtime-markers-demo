import { ViewStyle, StyleSheet, TextStyle } from "react-native";

// Inline styles
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    backgroundColor: "#333",
    zIndex: 10,
  },

  backButton: {
    padding: 8,
    borderRadius: 20,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },

  addButton: {
    padding: 8,
  },

  addButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Content area
  contentArea: {
    flex: 1,
  },

  // List styles
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },

  // Filter card styles
  filterCard: {
    backgroundColor: "#3a3a3a",
    borderRadius: 10,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
    transform: [{ scale: 1 }],
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    gap: 8,
  },

  filterIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  filterTitleContainer: {
    flex: 1,
    flexDirection: "column",
    gap: 2,
  },

  filterName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },

  filterQuery: {
    fontSize: 13,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    fontStyle: "italic",
    lineHeight: 16,
  },

  filterDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },

  filterDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },

  filterDetailText: {
    fontSize: 11,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginLeft: 2,
  },

  activeCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(64, 192, 87, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(64, 192, 87, 0.2)",
  },

  filterEmoji: {
    fontSize: 16,
    textAlign: "center",
    includeFontPadding: false,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 10,
  },

  filterActions: {
    display: "flex",
    flexDirection: "row",
    padding: 8,
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
  },

  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  applyButton: {
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    borderColor: "rgba(147, 197, 253, 0.2)",
  },

  applyButtonText: {
    color: "#93c5fd",
  },

  editButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },

  editButtonText: {
    color: "#f8f9fa",
  },

  deleteButton: {
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    borderColor: "rgba(249, 117, 131, 0.2)",
  },

  deleteButtonText: {
    color: "#f97583",
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },

  loadingText: {
    color: "#f8f9fa",
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
    borderRadius: 40,
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },

  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },

  retryButton: {
    backgroundColor: "rgba(147, 197, 253, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  retryButtonText: {
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "600",
    fontSize: 14,
  },

  // Empty state
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },

  emptyStateDescription: {
    fontSize: 14,
    color: "#adb5bd",
    textAlign: "center",
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },

  createFilterButton: {
    position: "relative",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    overflow: "hidden",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },

  buttonGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  createFilterText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  // Bottom button
  bottomButtonContainer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#333",
    borderTopWidth: 1,
    borderTopColor: "#3a3a3a",
  },

  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },

  clearButtonText: {
    color: "#f97583",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginLeft: 8,
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
