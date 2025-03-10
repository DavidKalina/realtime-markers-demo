import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 20,
    padding: 8,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicator: {
    width: 28,
    height: 28,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  connected: {
    backgroundColor: "#4caf50",
  },
  disconnected: {
    backgroundColor: "#f44336",
  },
  // Add new styles for notification types
  notificationAdded: {
    backgroundColor: "#2196f3", // Blue for additions
  },
  notificationRemoved: {
    backgroundColor: "#ff9800", // Orange for removals
  },
  textContainer: {
    flexDirection: "column",
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  countText: {
    color: "#e0e0e0",
    fontSize: 8,
    fontFamily: "SpaceMono",
  },
  connecting: {
    backgroundColor: "#ffa94d",
  },
});
