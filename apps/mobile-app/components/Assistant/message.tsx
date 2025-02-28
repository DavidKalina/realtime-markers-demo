// styles/message.ts - Updated text alignment
import { StyleSheet } from "react-native";

export const message = StyleSheet.create({
  messageBubble: {
    backgroundColor: "#3a3a3a", // Match the event details card background
    borderRadius: 12,
    padding: 4,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    color: "#f8f9fa", // Match event details text color
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    minHeight: 48,
    fontFamily: "SpaceMono",
    textAlign: "left", // Changed from center to left for natural text streaming
  },
  transitionMessageText: {
    color: "#40c057", // Use verified green color for important messages
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center", // Keep this centered since it's a status message
    fontFamily: "SpaceMono",
  },
  dots: {
    color: "#4dabf7", // Match the blue color from event details buttons
    fontSize: 14,
    fontWeight: "bold",
  },
  // Rest of the message styles remain the same
  detailTitle: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  detailDescription: {
    color: "#cbd5e1",
    fontSize: 14,
    marginBottom: 12,
  },
  detailText: {
    color: "#93c5fd",
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  interactiveDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  detailActionIcon: {
    marginLeft: 8,
  },
  detailRow: {
    marginBottom: 16,
  },
});
