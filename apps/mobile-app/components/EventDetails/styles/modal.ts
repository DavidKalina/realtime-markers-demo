import { StyleSheet, Dimensions } from "react-native";
import { COLORS } from "../../Layout/ScreenLayout";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

export const modalStyles = StyleSheet.create({
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    paddingTop: 50,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: windowWidth,
    height: windowHeight * 0.7,
  },

  // Dialog Styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
    fontFamily: "SpaceMono",
  },
  dialogText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
    fontFamily: "SpaceMono",
    lineHeight: 22,
  },
  dialogButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  dialogButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  dialogButtonCancel: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  dialogButtonDelete: {
    backgroundColor: COLORS.errorBackground,
  },
  dialogButtonTextCancel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    color: COLORS.textPrimary,
  },
  dialogButtonTextDelete: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    color: "#ffffff",
  },
});
