import { Platform, StyleSheet } from "react-native";

export const actionView = StyleSheet.create({
  actionContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  actionModal: {
    position: "absolute",
    width: "95%",
    bottom: 200,
    margin: "auto",
    alignSelf: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 18,
    zIndex: 10,
    display: "flex",
    flexDirection: "column", // Ensure flex direction is column for proper layout
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
    borderRadius: 16,
  },
  actionBackButton: {
    padding: 8,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  actionScrollView: {
    flex: 1, // This ensures ScrollView takes available space
    padding: 16,
  },
  actionContent: {
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionFooter: {
    padding: 16,
    borderRadius: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    borderTopWidth: 1,
    borderTopColor: "#3a3a3a",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#2a2a2a",
  },
});
