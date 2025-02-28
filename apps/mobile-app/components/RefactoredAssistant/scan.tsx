// styles/scan.ts
// Updated styles with improved separation between elements
import { StyleSheet } from "react-native";

export const scan = StyleSheet.create({
  // Camera container
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000", // Pure black background
    position: "relative",
  },
  cameraView: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },

  // Status section - moved higher with background for separation
  statusSection: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    zIndex: 10,
  },
  scanStatusText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  perfectIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(55, 208, 92, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#37D05C", // Green circle
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  perfectText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "SpaceMono",
  },

  // Scan frame - properly positioned in the middle with more room
  scanFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    justifyContent: "center", // Center vertically
    alignItems: "center", // Center horizontally
  },

  // Scan border - frame dimensions with gradient overlay
  scanBorder: {
    position: "absolute",
    width: "85%",
    height: "55%", // Reduced height for better separation
    borderWidth: 3,
    borderColor: "#37D05C", // Green border
    borderRadius: 16,
    overflow: "hidden",
  },
  scanOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },

  // Scan line - animated line that moves through the frame
  scanLine: {
    position: "absolute",
    width: "100%",
    height: 2,
    backgroundColor: "rgba(77, 171, 247, 0.8)", // Semi-transparent blue line
    top: "50%",
  },

  // Corner brackets - adjusted to match new frame position
  cornerBracket: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#FFFFFF", // White brackets
  },
  topLeftBracket: {
    top: "22.5%", // Adjusted for new frame position
    left: "7.5%",
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 2,
  },
  topRightBracket: {
    top: "22.5%", // Adjusted for new frame position
    right: "7.5%",
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 2,
  },
  bottomLeftBracket: {
    bottom: "22.5%", // Adjusted for new frame position
    left: "7.5%",
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 2,
  },
  bottomRightBracket: {
    bottom: "22.5%", // Adjusted for new frame position
    right: "7.5%",
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 2,
  },

  // Controls section - with clear visual boundary
  controlsSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    paddingBottom: 40,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  controlButtonLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginTop: 6,
    textAlign: "center",
  },
  controlButtonWrapper: {
    alignItems: "center",
    marginHorizontal: 30,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(33, 33, 33, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonWrapper: {
    alignItems: "center",
  },
  captureButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "rgba(0, 60, 100, 0.7)", // Dark blue background
    borderWidth: 3,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 40,
  },
  captureReady: {
    borderColor: "#4dabf7",
    backgroundColor: "rgba(0, 86, 143, 0.8)",
  },
  captureLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginTop: 6,
  },

  // Close button - repositioned
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(33, 33, 33, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },

  // Permission container
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#333",
  },
  permissionText: {
    color: "#f8f9fa",
    fontSize: 16,
    textAlign: "center",
    fontFamily: "SpaceMono",
    maxWidth: "80%",
  },
});
