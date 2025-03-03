// styles/action.ts
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  bottomBar: {
    height: 60, // Slightly taller for better touch targets
    backgroundColor: "#333", // Match event details dark background
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopColor: "#3a3a3a", // Subtle border like event details
  },
  chevronContainer: {
    width: 48, // Fixed width for chevron buttons
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionButton: {
    padding: 10,
    borderRadius: 10, // More rounded corners like event details buttons
    marginHorizontal: 2,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  labeledActionButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionButtonLabel: {
    color: "#f8f9fa", // Match event details text color
    fontSize: 10,
    fontFamily: "SpaceMono",
    marginTop: 4,
    textAlign: "center",
  },

  activeActionButton: {
    backgroundColor: "#4a4a4a", // Match event details button color
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  actionButtonText: {
    fontFamily: "SpaceMono",
    color: "#fff", // steel blue light variant
    fontSize: 12,
    fontWeight: "500",
  },
  detailActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
  },
  detailActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#374151",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  detailActionText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  detailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  detailButtonText: {
    fontFamily: "SpaceMono",
    color: "#cbd5e1", // steel blue light variant
    fontSize: 14,
    fontWeight: "500",
  },
  iconSmall: {
    marginRight: 2,
  },
});
