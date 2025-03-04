import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // Base container styles from EventDetails
  container: {
    flex: 1,
    backgroundColor: "#333",
    fontFamily: "SpaceMono",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
    backgroundColor: "#333",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: "#f8f9fa",
    marginLeft: 16,
  },
  contentArea: {
    flex: 1,
  },

  // Loading and error states from EventDetails
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#93c5fd",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#333",
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  noResults: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  noResultsText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 16,
    textAlign: "center",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  // Event header styles from EventDetails but modified for ShareEvent
  eventHeaderContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    backgroundColor: "#444",
    borderRadius: 12,
    marginBottom: 16,
  },
  eventTitleWrapper: {
    flex: 1,
  },
  resultEmoji: {
    fontSize: 36,
    marginRight: 12,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 12,
  },

  // Details container styles from EventDetails
  detailsContainer: {
    backgroundColor: "#3a3a3a",
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 8,
  },

  customMessageInput: {
    backgroundColor: "#444",
    color: "#fff",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    minHeight: 60,
  },

  searchInput: {
    backgroundColor: "#444",
    color: "#fff",
    borderRadius: 8,
    fontFamily: "SpaceMono",
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  contactsListContainer: {
    flex: 1,
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  noContactsText: {
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    fontSize: 14,
    textAlign: "center",
    padding: 16,
  },

  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  mapButtonText: {
    color: "#93c5fd",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },

  // Contact item styles from ShareEvent
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#444",
  },
  contactItemSelected: {
    backgroundColor: "#4a4a4a",
    borderLeftWidth: 3,
    borderLeftColor: "#93c5fd",
  },
  contactItemNoPhone: {
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  contactAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#93c5fd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contactInitial: {
    color: "#333",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "SpaceMono",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  contactDetail: {
    fontSize: 13,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
  },
  checkboxContainer: {
    marginLeft: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#adb5bd",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#40c057",
    borderColor: "#40c057",
  },
  checkmark: {
    color: "#f8f9fa",
    fontSize: 16,
  },

  // Email specific styles
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  emailWarning: {
    color: "#f59e0b",
    fontSize: 12,
    marginLeft: 6,
    fontFamily: "SpaceMono",
  },

  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    marginTop: "auto", // Pushes the buttons to the bottom
  },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    fontFamily: "SpaceMono",
  },
  smsButton: {
    backgroundColor: "#93c5fd",
  },
  emailButton: {
    backgroundColor: "#f59e0b",
  },

  // Status display
  progressText: {
    color: "#f8f9fa",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 16,
    fontFamily: "SpaceMono",
  },
  flatListContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  loadingFooter: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  loadingFooterText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#93c5fd",
  },
  shareContainer: {
    flex: 1,
    padding: 12,
    backgroundColor: "#333",
  },
  messageContainer: {
    backgroundColor: "#444",
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    overflow: "hidden",
  },
  contactSelectContainer: {
    backgroundColor: "#333",
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 16,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },

  searchContainer: {
    marginBottom: 8,
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 12,
  },
});
