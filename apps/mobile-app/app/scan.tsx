import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton/CaptureButton";
import { ScannerOverlay } from "@/components/ScannerOverlay/ScannerOverlay";
import { useCamera } from "@/hooks/useCamera";
import { Feather } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
} from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "@/services/ApiClient";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";
import { useJobQueueStore } from "@/stores/useJobQueueStore";

type DetectionStatus = "none" | "detecting" | "aligned";

export default function ScanScreen() {
  const {
    hasPermission,
    cameraRef,
    takePicture,
    isCapturing,
    isCameraActive,
    isCameraReady,
    onCameraReady,
    releaseCamera,
  } = useCamera();

  const router = useRouter();
  const detectionIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("none");
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [isCameraInitializing, setIsCameraInitializing] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Access job queue store directly
  const addJob = useJobQueueStore((state) => state.addJob);

  // Get the event broker
  const { publish } = useEventBroker();

  // Clear detection interval function
  const clearDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // When we enter the screen, we may need to reinitialize
      if (!isCameraActive || !isCameraReady) {
        setIsCameraInitializing(true);

        // Add a backup timer to exit initialization state
        const backupTimer = setTimeout(() => {
          if (hasPermission === true) {
            setIsCameraInitializing(false);
          }
        }, 6000); // 6 second backup

        return () => clearTimeout(backupTimer);
      }

      return () => {
        // Clean up on unfocus
        clearDetectionInterval();
      };
    }, [isCameraActive, isCameraReady, hasPermission, clearDetectionInterval])
  );

  // Safety timer
  useEffect(() => {
    // This is a fallback safety mechanism to ensure we don't get stuck
    const masterSafetyTimer = setTimeout(() => {
      if (isCameraInitializing && hasPermission === true) {
        setIsCameraInitializing(false);
      }
    }, 10000); // 10 second master safety timeout

    return () => clearTimeout(masterSafetyTimer);
  }, [isCameraInitializing, hasPermission]);

  // Camera initialization
  useEffect(() => {
    if (hasPermission && isCameraReady) {
      // Both permission granted and camera is ready
      setIsCameraInitializing(false);
    } else if (hasPermission === false) {
      // If permission is explicitly denied, we should not show loading
      setIsCameraInitializing(false);
    } else if (hasPermission === true && !isCameraReady && isCameraActive) {
      // Permission is granted, camera is active but not ready yet
      // Set a safety timeout to avoid being stuck in initializing state
      const safetyTimer = setTimeout(() => {
        setIsCameraInitializing(false);
      }, 5000); // 5 second safety timeout

      return () => clearTimeout(safetyTimer);
    }
  }, [hasPermission, isCameraReady, isCameraActive]);

  // Document detection simulation
  const startDocumentDetection = useCallback(() => {
    // Clear any existing interval first
    clearDetectionInterval();

    if (!isCameraActive || !isCameraReady) return;

    // Simulate varying detection confidence
    const interval = setInterval(() => {
      // Only process if component is still mounted and camera is active
      if (!isCameraActive || !isCameraReady) {
        clearInterval(interval);
        return;
      }

      const random = Math.random();

      // Provide guidance based on simulated detection
      if (random < 0.3) {
        setDetectionStatus("none");
        setIsFrameReady(false);
      } else if (random < 0.7) {
        setDetectionStatus("detecting");
        setIsFrameReady(false);
      } else {
        setDetectionStatus("aligned");
        setIsFrameReady(true);
      }
    }, 800); // Update every 800ms

    detectionIntervalRef.current = interval;
  }, [isCameraActive, isCameraReady, clearDetectionInterval]);

  // Start detection when camera becomes active and ready
  useEffect(() => {
    if (isCameraActive && isCameraReady && !isCapturing && !isUploading) {
      startDocumentDetection();
    } else {
      clearDetectionInterval();
    }

    // Clean up on unmount
    return () => {
      clearDetectionInterval();
    };
  }, [
    isCameraActive,
    isCameraReady,
    isCapturing,
    isUploading,
    startDocumentDetection,
    clearDetectionInterval,
  ]);

  useEffect(() => {
    // The cleanup function
    return () => {
      // Make sure to cancel any ongoing operations when unmounting
      clearDetectionInterval();

      // Just call releaseCamera directly instead of using a timeout with nested cleanup
      releaseCamera();
    };
  }, [clearDetectionInterval, releaseCamera]);

  // Handle job queuing and navigation in one place to avoid race conditions
  const queueJobAndNavigate = useCallback(
    (jobId: string) => {
      if (!jobId) return;

      // Add to job queue
      addJob(jobId);

      // Publish event
      publish(EventTypes.JOB_QUEUED, {
        timestamp: Date.now(),
        source: "ScanScreen",
        jobId: jobId,
        message: "Document scan queued for processing",
      });

      // Clean up before navigation
      clearDetectionInterval();

      // Delay navigation slightly to allow state to settle
      setTimeout(() => {
        router.replace("/");
      }, 300);
    },
    [addJob, publish, clearDetectionInterval, router]
  );

  // Upload image and queue job
  const uploadImageAndQueueJob = async (uri: string) => {
    try {
      // Create a FormData object to send the image
      const formData = new FormData();

      // Create a File object from the URI
      const imageFile = {
        uri,
        name: "image.jpg",
        type: "image/jpeg",
      } as any;

      formData.append("image", imageFile);

      // Use fetch directly with our custom FormData
      const response = await fetch(`${apiClient.baseUrl}/api/events/process`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const result = await response.json();

      if (result.jobId) {
        // Use our simplified function to queue job and navigate
        queueJobAndNavigate(result.jobId);
        return result.jobId;
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      console.error("Upload failed:", error);

      // Publish error event
      publish(EventTypes.ERROR_OCCURRED, {
        timestamp: Date.now(),
        source: "ScanScreen",
        error: `Failed to upload image: ${error}`,
      });

      throw error; // Re-throw to handle in the calling function
    }
  };

  const handlePermissionGranted = useCallback(() => {
    // Force reset the initialization state when we get permission
    setIsCameraInitializing(true);
  }, []);

  const handleCapture = async () => {
    // Stop detection while capturing
    clearDetectionInterval();

    // Set loading state
    setIsUploading(true);

    try {
      // Capture the image
      const uri = await takePicture();

      if (!uri) {
        throw new Error("Failed to capture image");
      }

      // Show a brief toast or indicator that we're processing
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Processing document...",
      });

      // Upload the image and queue the job
      await uploadImageAndQueueJob(uri);
    } catch (error) {
      console.error("Capture failed:", error);

      // Show an error alert
      Alert.alert("Operation Failed", "Failed to process the document. Please try again.", [
        { text: "OK" },
      ]);

      // Reset state to allow retry
      setIsUploading(false);

      // Restart detection
      startDocumentDetection();
    }
  };

  const handleFrameReady = () => {
    // Optional: auto-capture when frame is well-aligned
  };

  const handleBack = () => {
    // Ensure we clean up resources before navigating away
    clearDetectionInterval();

    // Small delay before navigation
    setTimeout(() => {
      releaseCamera();
      router.replace("/");
    }, 100);
  };

  // Don't render camera if we're not on this screen
  if (!isCameraActive && !isCameraInitializing) {
    return null;
  }

  // Show loading state while camera is initializing
  if (isCameraInitializing) {
    return (
      <View style={styles.container}>
        <Animated.View style={styles.processingContainer} entering={FadeIn.duration(500)}>
          <Animated.View style={styles.loadingIcon}>
            <Feather name="camera" size={36} color="#4dabf7" />
          </Animated.View>
          <Text style={styles.processingText}>
            {hasPermission ? "Initializing camera..." : "Waiting for camera permissions..."}
          </Text>
        </Animated.View>
      </View>
    );
  }

  // Handle camera permission request if needed
  if (!hasPermission) {
    return <CameraPermission onPermissionGranted={handlePermissionGranted} />;
  }

  // Main camera view
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View style={styles.header} entering={FadeIn.duration(500)}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <View style={styles.backButtonContainer}>
            <Feather name="arrow-left" size={20} color="#f8f9fa" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerText}>Scan Document</Text>
      </Animated.View>

      {/* Flexible camera container */}
      <View style={styles.flexContainer}>
        <Animated.View style={styles.cameraContainer} entering={FadeIn.duration(800)}>
          <CameraView ref={cameraRef} style={styles.camera} onCameraReady={onCameraReady}>
            <ScannerOverlay detectionStatus={detectionStatus} onFrameReady={handleFrameReady} />
          </CameraView>

          {/* Separate overlay view to avoid conflicts with CameraView */}
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <View style={styles.uploadingIndicator}>
                <Feather name="upload-cloud" size={24} color="#fff" />
              </View>
              <Text style={styles.uploadingText}>Capturing...</Text>
            </View>
          )}
        </Animated.View>
      </View>

      {/* Bottom button container with fixed height */}
      <View style={styles.buttonContainer}>
        <Animated.View
          entering={SlideInDown.duration(500).delay(200)}
          style={styles.captureButtonWrapper}
        >
          <CaptureButton
            onPress={handleCapture}
            isCapturing={isCapturing || isUploading}
            isReady={isFrameReady}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333", // Matches the app's dark theme
    display: "flex",
    flexDirection: "column",
  },
  processingContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3a3a3a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  processingText: {
    marginTop: 16,
    fontSize: 18,
    color: "#FFF",
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
    backgroundColor: "#333", // Match the app theme
    // Using explicit height to ensure consistent spacing
    height: 60,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3a3a3a",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  headerText: {
    color: "#f8f9fa",
    fontSize: 18,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  flexContainer: {
    flex: 1, // This will take all available space between header and button
    position: "relative",
  },
  cameraContainer: {
    flex: 1,
    position: "relative", // Important for overlay positioning
    overflow: "hidden", // Ensure nothing overflows
  },
  camera: {
    flex: 1,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  uploadingIndicator: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(77, 171, 247, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    color: "#fff",
    marginTop: 16,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  buttonContainer: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    // Safeguard for devices with notches or home indicators
    paddingBottom: Platform.OS === "ios" ? 16 : 0,
  },
  captureButtonWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
});
