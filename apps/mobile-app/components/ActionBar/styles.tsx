// styles/action.ts - Updated with more refined button selection styles
import { Platform, StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  bottomBar: {
    height: 65, // Reduced height
    backgroundColor: "#1a1a1a", // Match Cluster Events view background
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4, // Reduced padding
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)", // Subtle border matching our card styles
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  chevronContainer: {
    width: 48, // Fixed width for chevron buttons
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionButton: {
    padding: 4, // Reduced padding
    borderRadius: 8, // Slightly smaller corners
    marginHorizontal: 2, // Reduced margin
    width: 48, // Reduced width
    height: 48, // Reduced height
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  labeledActionButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4, // Reduced padding
  },
  actionButtonLabel: {
    color: "#a0a0a0", // Match Cluster Events view textSecondary
    fontSize: 9, // Smaller font size
    fontFamily: "SpaceMono",
    marginTop: 2, // Reduced margin
    textAlign: "center",
  },
  activeActionButtonLabel: {
    color: "#93c5fd", // Match Cluster Events view accent
  },
  actionButtonIcon: {
    width: 18, // Smaller icon container
    height: 18, // Smaller icon container
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  actionButtonText: {
    fontFamily: "SpaceMono",
    color: "#f8f9fa",
    fontSize: 12,
    fontWeight: "500",
  },
  detailActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 8,
  },
  detailActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10, // Slightly more refined corners
    backgroundColor: "#1a1a1a", // Match Cluster Events view background
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  detailActionText: {
    color: "#f8f9fa", // Light text for dark theme
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 6,
  },
  iconSmall: {
    marginRight: 2,
  },
});
