// styles/share-event-dark-styles.ts
import { Platform, StyleSheet } from "react-native";

export const shareEventStyles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a", // Darker divider line
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#f8f9fa", // Light text color
    fontFamily: "SpaceMono",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4a4a4a", // Darker button background
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 24,
    color: "#f8f9fa", // Light text color
  },
  eventPreview: {
    padding: 16,
    marginVertical: 16,
    backgroundColor: "#3a3a3a", // Darker card background
    borderRadius: 12, // Matching the detailsCard radius
    borderLeftWidth: 4,
    borderLeftColor: "#93c5fd", // Using the sectionTitle color from details
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#f8f9fa", // Light text color
    marginBottom: 8,
    fontFamily: "SpaceMono",
  },
  previewTime: {
    fontSize: 15,
    color: "#f8f9fa", // Light text color
    marginBottom: 4,
    fontFamily: "SpaceMono",
  },
  previewLocation: {
    fontSize: 15,
    color: "#f8f9fa", // Light text color
    fontFamily: "SpaceMono",
  },
  customMessageContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#4a4a4a", // Darker border
    borderRadius: 12,
    backgroundColor: "#3a3a3a", // Darker background
  },
  customMessageInput: {
    padding: 12,
    height: 80,
    textAlignVertical: "top",
    color: "#f8f9fa", // Light text color
    fontFamily: "SpaceMono",
  },
  searchContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#4a4a4a", // Darker border
    borderRadius: 12,
    backgroundColor: "#3a3a3a", // Darker background
  },
  searchInput: {
    padding: 10,
    color: "#f8f9fa", // Light text color
    fontFamily: "SpaceMono",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#93c5fd", // Matching sectionTitle from details
    fontFamily: "SpaceMono",
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#4a4a4a", // Darker divider
  },
  contactItemSelected: {
    backgroundColor: "#4a4a4a", // Slightly lighter than background for selection
  },
  contactAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#93c5fd", // Using accent color
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contactInitial: {
    color: "#333", // Dark text on light background
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
    color: "#f8f9fa", // Light text color
    fontFamily: "SpaceMono",
  },
  contactDetail: {
    fontSize: 13,
    color: "#adb5bd", // Lighter gray for secondary text
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
    borderColor: "#adb5bd", // Light border
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#40c057", // Using the statusBadge color from details
    borderColor: "#40c057",
  },
  checkmark: {
    color: "#f8f9fa", // Light check color
    fontSize: 16,
  },
  footer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#3a3a3a", // Darker divider
    paddingBottom: Platform.OS === "ios" ? 32 : 20, // Matching footer padding
  },
  shareButton: {
    backgroundColor: "#93c5fd", // Using accent color
    borderRadius: 10, // Matching categoryBadge
    padding: 16,
    alignItems: "center",
  },
  shareButtonDisabled: {
    backgroundColor: "#4a4a4a", // Darker disabled state
    opacity: 0.7,
  },
  shareButtonText: {
    color: "#333", // Dark text on light button
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  errorText: {
    color: "#f97583", // Error red that works on dark background
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#93c5fd", // Using accent color
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#333", // Dark text on light button
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  permissionButton: {
    backgroundColor: "#93c5fd", // Using accent color
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    minWidth: 160,
  },
  permissionButtonText: {
    color: "#333", // Dark text on light button
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
});
