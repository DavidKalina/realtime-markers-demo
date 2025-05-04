import { StyleSheet, Platform } from "react-native";

export const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  overlayTouchable: {
    flex: 1,
  },
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    color: "#f8f9fa",
    fontSize: 18,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  closeButton: {
    padding: 8,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    color: "#f8f9fa",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  actionDescription: {
    color: "#a0a0a0",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
});
