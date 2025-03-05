// styles/layout.ts - Update to container and innerContainer
import { StyleSheet } from "react-native";

export const layout = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%", // Add full width
  },
  innerContainer: {
    position: "absolute",
    bottom: 0, // Remove bottom margin to anchor at bottom
    width: "100%", // Full width
    alignSelf: "center",
    zIndex: 10000000,
  },
  card: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 0, // Remove the border radius at top
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: "hidden",
    flexDirection: "column",
    height: 150,
    borderWidth: 1,
    borderColor: "#3a3a3a", // Subtle border like event details
  },
  row: {
    flexDirection: "row",
    flex: 1,
    padding: 8,
    gap: 4,
  },

  fixedActionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    flex: 1,
  },
  scrollViewContainer: {
    flex: 1,
    height: 50,
  },
  scrollableActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: 4,
  },
  detailRow: {
    marginBottom: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  primaryButton: {
    backgroundColor: "#4dabf7", // Keep this blue for directions
  },
  secondaryButton: {
    backgroundColor: "#4a4a4a",
    borderWidth: 1,
    borderColor: "#5a5a5a",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  secondaryButtonText: {
    color: "#f8f9fa",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  buttonIcon: {
    marginRight: 8,
  },
  eventEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  icon: {
    marginRight: 4,
  },
});
