// styles/action.ts - Updated with more refined button selection styles
import { Platform, StyleSheet } from "react-native";

// Updated color scheme to match register/login screens
const newColors = {
  background: "#00697A",
  text: "#FFFFFF",
  accent: "#FDB813",
  cardBackground: "#FFFFFF",
  cardText: "#000000",
  cardTextSecondary: "#6c757d",
  buttonBackground: "#FFFFFF",
  buttonText: "#00697A",
  buttonBorder: "#DDDDDD",
  inputBackground: "#F5F5F5",
  errorBackground: "#FFCDD2",
  errorText: "#B71C1C",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
  activityIndicator: "#00697A",
};

export const styles = StyleSheet.create({
  bottomBar: {
    height: 90, // Increased height further to accommodate labels
    backgroundColor: newColors.background, // Updated to teal background
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4, // Reduced padding
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)", // Updated for better contrast on teal
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.2, // Increased shadow opacity for better visibility on teal
        shadowRadius: 4, // Updated to match StatusBar shadow radius
      },
      android: {
        elevation: 3, // Updated to match StatusBar elevation
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
    borderRadius: 12,
    marginHorizontal: 4,
    width: 44,
    height: 44,
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
    paddingVertical: 8, // Increased padding for better touch targets
    paddingHorizontal: 2, // Reduced horizontal padding to reduce gaps
    minWidth: 50, // Set minimum width for consistent spacing
    flex: 1, // Allow buttons to take equal space
    height: 70, // Set explicit height to ensure labels have space
  },
  actionButtonLabel: {
    color: "rgba(255, 255, 255, 0.9)", // Semi-transparent white for inactive state
    fontSize: 11, // Increased font size for better visibility
    fontFamily: "Poppins-SemiBold", // Changed to SemiBold
    marginTop: 4, // Increased margin for better spacing
    textAlign: "center",
  },
  activeActionButtonLabel: {
    color: newColors.accent, // Municipal accent color (#FDB813) for active state
    fontWeight: "600", // Make active labels slightly bolder
  },
  actionButtonIcon: {
    width: 22, // Slightly smaller icon container for labeled buttons
    height: 22, // Slightly smaller icon container for labeled buttons
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  actionButtonText: {
    fontFamily: "Poppins-Regular",
    color: newColors.text, // White text for teal background
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
    fontFamily: "Poppins-Regular",
    marginLeft: 6,
  },
  iconSmall: {
    marginRight: 2,
  },
});
