import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // Base container - even more compact without progress bar
  container: {
    flexDirection: "row",
    position: "absolute",
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
    width: 160, // More compact width
    maxWidth: 160, // Ensure it doesn't grow beyond this
  },

  // Icon indicator
  indicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  // Content area
  contentContainer: {
    flexDirection: "column",
    flex: 1,
    overflow: "hidden", // Ensure content doesn't overflow
  },

  // Status text
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    overflow: "hidden", // Ensure text truncation works
  },

  // Job count text
  countText: {
    color: "#e0e0e0",
    fontSize: 9,
    fontFamily: "SpaceMono",
    marginTop: 2,
  },

  // Removed progress bar styles
});
