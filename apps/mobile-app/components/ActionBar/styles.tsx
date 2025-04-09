// styles/action.ts - Updated with more refined button selection styles
import { Platform, StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  bottomBar: {
    height: 75, // Slightly taller for better touch targets
    backgroundColor: "#2C3333",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
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
    padding: 8,
    borderRadius: 10, // Slightly more refined corners
    marginHorizontal: 6,
    width: 60,
    height: 56,
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
    paddingVertical: 8,
  },
  actionButtonLabel: {
    color: "#adb5bd", // Subtle gray for inactive
    fontSize: 10,
    fontFamily: "SpaceMono",
    marginTop: 5,
    textAlign: "center",
  },

  activeActionButtonLabel: {
    color: "#93c5fd", // Match the icon color when active
  },
  actionButtonIcon: {
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  actionButtonText: {
    fontFamily: "SpaceMono",
    color: "#fff", // Light text for dark theme
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
    backgroundColor: '#2C3333',
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
