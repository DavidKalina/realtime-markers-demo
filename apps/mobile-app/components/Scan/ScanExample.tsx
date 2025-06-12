import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useScanState } from "./useScanState";
import { ProcessingOverlay } from "./ProcessingOverlay";
import { NoScansOverlay } from "./NoScansOverlay";

interface ScanExampleProps {
  processImage: (uri: string) => Promise<string | null>;
  isNetworkSuitable: () => boolean;
  onNavigateToJobs: () => void;
  takePicture: () => Promise<string>;
  selectImage: () => Promise<string>;
}

export const ScanExample: React.FC<ScanExampleProps> = ({
  processImage,
  isNetworkSuitable,
  onNavigateToJobs,
  takePicture,
  selectImage,
}) => {
  const isMounted = useRef(true);

  // Use the new unified scan state hook
  const {
    // Camera state
    isCameraInitialized,
    cameraError,

    // Capture state
    isCapturing,
    capturedImageUri,

    // Processing state
    isProcessing,
    processingStage,
    showProcessingOverlay,

    // Scan limits
    hasRemainingScans,
    showNoScansOverlay,
    setShowNoScansOverlay,

    // Actions
    handleCapture,
    handleImageSelected,
    reset,
    clearError,

    // Computed values
    isLoading,
    canInteract,
  } = useScanState({
    processImage,
    isNetworkSuitable,
    isMounted,
    onNavigateToJobs,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle camera capture
  const onCapturePress = async () => {
    if (!canInteract) return;

    const result = await handleCapture(takePicture);

    if (!result.success) {
      switch (result.error) {
        case "no_scans":
          setShowNoScansOverlay(true);
          break;
        case "network":
          Alert.alert(
            "Network Error",
            "Please check your connection and try again.",
          );
          break;
        default:
          Alert.alert("Error", "Failed to capture image. Please try again.");
      }
    }
  };

  // Handle gallery selection
  const onGalleryPress = async () => {
    if (!canInteract) return;

    try {
      const uri = await selectImage();
      const result = await handleImageSelected(uri);

      if (!result.success) {
        switch (result.error) {
          case "no_scans":
            setShowNoScansOverlay(true);
            break;
          case "network":
            Alert.alert(
              "Network Error",
              "Please check your connection and try again.",
            );
            break;
          default:
            Alert.alert("Error", "Failed to process image. Please try again.");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select image from gallery.");
    }
  };

  // Handle reset
  const onResetPress = () => {
    reset();
    clearError();
  };

  return (
    <View style={styles.container}>
      {/* Camera Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Camera: {isCameraInitialized ? "Ready" : "Initializing..."}
        </Text>
        {cameraError && (
          <Text style={styles.errorText}>Camera Error: {cameraError}</Text>
        )}
        <Text style={styles.statusText}>
          Scans Remaining: {hasRemainingScans ? "Available" : "None"}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, !canInteract && styles.buttonDisabled]}
          onPress={onCapturePress}
          disabled={!canInteract || isCapturing}
        >
          <Text style={styles.buttonText}>
            {isCapturing ? "Capturing..." : "Capture Photo"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !canInteract && styles.buttonDisabled]}
          onPress={onGalleryPress}
          disabled={!canInteract || isProcessing}
        >
          <Text style={styles.buttonText}>
            {isProcessing ? "Processing..." : "Select from Gallery"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={onResetPress}
        >
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* Processing Overlay */}
      <ProcessingOverlay
        isVisible={showProcessingOverlay}
        stage={processingStage}
        capturedImageUri={capturedImageUri}
      />

      {/* No Scans Overlay */}
      <NoScansOverlay
        isVisible={showNoScansOverlay}
        onDismiss={() => setShowNoScansOverlay(false)}
        onUpgrade={() => {
          // Handle upgrade logic here
          setShowNoScansOverlay(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  statusContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 5,
    color: "#333",
  },
  errorText: {
    fontSize: 14,
    color: "#d32f2f",
    marginBottom: 5,
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    backgroundColor: "#2196f3",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  resetButton: {
    backgroundColor: "#ff9800",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
