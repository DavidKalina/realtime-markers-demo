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
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { useUserLocation } from "@/contexts/LocationContext";
import { AuthWrapper } from "@/components/AuthWrapper";

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
  const isMounted = useRef(true); // Track if component is mounted

  const { userLocation } = useUserLocation();

  // Access job queue store directly
  const addJob = useJobSessionStore((state) => state.addJob);

  // Get the event broker
  const { publish } = useEventBroker();

  // Clear detection interval function with isMounted check
  const clearDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  // Set mounted flag to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      // When we enter the screen, we may need to reinitialize
      if (!isCameraActive || !isCameraReady) {
        if (isMounted.current) {
          setIsCameraInitializing(true);
        }

        // Single backup timer for initialization
        const backupTimer = setTimeout(() => {
          if (isMounted.current && hasPermission === true) {
            setIsCameraInitializing(false);
          }
        }, 2500); // 2.5 seconds is enough

        return () => {
          clearTimeout(backupTimer);
          clearDetectionInterval();
        };
      }

      return () => {
        // Clean up on unfocus
        clearDetectionInterval();
      };
    }, [isCameraActive, isCameraReady, hasPermission, clearDetectionInterval])
  );

  // Simplified camera initialization
  useEffect(() => {
    // Consolidated timer logic into a single effect
    if (!isMounted.current) return;

    let initTimer: ReturnType<typeof setTimeout> | null = null;

    if (hasPermission && isCameraReady) {
      // Both permission granted and camera is ready
      setIsCameraInitializing(false);
    } else if (hasPermission === false) {
      // If permission is explicitly denied, we should not show loading
      setIsCameraInitializing(false);
    } else if (hasPermission === true && !isCameraReady && isCameraActive) {
      // Set a single timer with reasonable timeout
      initTimer = setTimeout(() => {
        if (isMounted.current) {
          setIsCameraInitializing(false);
        }
      }, 2500); // 2.5 seconds should be sufficient
    }

    return () => {
      if (initTimer) {
        clearTimeout(initTimer);
      }
    };
  }, [hasPermission, isCameraReady, isCameraActive]);

  // More stable document detection logic
  const startDocumentDetection = useCallback(() => {
    // Clear any existing interval first
    clearDetectionInterval();

    if (!isCameraActive || !isCameraReady || !isMounted.current) return;

    // Using a more deterministic, less random approach
    let counter = 0;
    let stableAlignedCounter = 0;
    const MAX_STABLE_COUNT = 5; // Number of stable aligned detections to consider it ready

    // Fixed states for different phases instead of random values
    const interval = setInterval(() => {
      // Safety check - only process if component is still mounted and camera is active
      if (!isMounted.current || !isCameraActive || !isCameraReady) {
        clearInterval(interval);
        return;
      }

      counter++;

      // Deterministic state progression
      if (counter <= 2) {
        // Initial state - always "none"
        if (isMounted.current) {
          setDetectionStatus("none");
          setIsFrameReady(false);
        }
      } else if (counter <= 5) {
        // Transition to detecting
        if (isMounted.current) {
          setDetectionStatus("detecting");
          setIsFrameReady(false);
        }
      } else {
        // After initial phase, use a more stable approach
        if (counter % 3 === 0) {
          // Only every 3rd cycle to reduce updates
          // Gradually increase probability of being "aligned"
          const alignProbability = Math.min(0.7, 0.3 + (counter - 5) * 0.05);

          if (Math.random() < alignProbability) {
            stableAlignedCounter++;

            if (stableAlignedCounter >= MAX_STABLE_COUNT) {
              // Stable aligned state reached
              if (isMounted.current) {
                setDetectionStatus("aligned");
                setIsFrameReady(true);
              }
            } else {
              // Not enough consecutive aligned detections yet
              if (isMounted.current) {
                setDetectionStatus("detecting");
                setIsFrameReady(false);
              }
            }
          } else {
            // Reset stable counter when not aligned
            stableAlignedCounter = 0;
            if (isMounted.current) {
              setDetectionStatus("detecting");
              setIsFrameReady(false);
            }
          }
        }
      }
    }, 500); // 500ms interval reduces state updates while still being responsive

    detectionIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [isCameraActive, isCameraReady, clearDetectionInterval]);

  // Start detection when camera becomes active and ready
  useEffect(() => {
    if (!isMounted.current) return;

    if (isCameraActive && isCameraReady && !isCapturing && !isUploading) {
      startDocumentDetection();
    } else {
      clearDetectionInterval();
    }

    // Clean up on unmount or deps change
    return clearDetectionInterval;
  }, [
    isCameraActive,
    isCameraReady,
    isCapturing,
    isUploading,
    startDocumentDetection,
    clearDetectionInterval,
  ]);

  // Clean up resources on component unmount
  useEffect(() => {
    return () => {
      clearDetectionInterval();
      releaseCamera();
      isMounted.current = false;
    };
  }, [clearDetectionInterval, releaseCamera]);

  // Handle job queuing and navigation
  const queueJobAndNavigate = useCallback(
    (jobId: string) => {
      if (!jobId || !isMounted.current) return;

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

      // Only navigate if component is still mounted
      const navTimer = setTimeout(() => {
        if (isMounted.current) {
          router.replace("/");
        }
      }, 200);

      return () => clearTimeout(navTimer);
    },
    [addJob, publish, clearDetectionInterval, router]
  );

  // Upload image and queue job
  const uploadImageAndQueueJob = async (uri: string) => {
    if (!isMounted.current) return null;

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

      if (userLocation) {
        formData.append("userLng", userLocation[0].toString());
        formData.append("userLat", userLocation[1].toString());
      }

      const result = await apiClient.processEventImage(imageFile);

      if (result.jobId && isMounted.current) {
        // Use our simplified function to queue job and navigate
        queueJobAndNavigate(result.jobId);
        return result.jobId;
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      console.error("Upload failed:", error);

      // Only publish if component is still mounted
      if (isMounted.current) {
        // Publish error event
        publish(EventTypes.ERROR_OCCURRED, {
          timestamp: Date.now(),
          source: "ScanScreen",
          error: `Failed to upload image: ${error}`,
        });
      }

      throw error; // Re-throw to handle in the calling function
    }
  };

  const handlePermissionGranted = useCallback(() => {
    // Force reset the initialization state when we get permission
    if (isMounted.current) {
      setIsCameraInitializing(true);
    }
  }, []);

  const handleCapture = async () => {
    if (!isMounted.current) return;

    // Stop detection while capturing
    clearDetectionInterval();

    // Set loading state
    setIsUploading(true);

    try {
      // Capture the image
      const uri = await takePicture();

      if (!uri || !isMounted.current) {
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

      // Only show alert if component is still mounted
      if (isMounted.current) {
        // Show an error alert
        Alert.alert("Operation Failed", "Failed to process the document. Please try again.", [
          { text: "OK" },
        ]);

        // Reset state to allow retry
        setIsUploading(false);

        // Restart detection
        startDocumentDetection();
      }
    }
  };

  const handleBack = () => {
    if (!isMounted.current) return;

    // Ensure we clean up resources before navigating away
    clearDetectionInterval();

    // Small delay before navigation
    const navTimer = setTimeout(() => {
      if (isMounted.current) {
        releaseCamera();
        router.replace("/");
      }
    }, 50);

    return () => clearTimeout(navTimer);
  };

  // Don't render camera if we're not on this screen
  if ((!isCameraActive && !isCameraInitializing) || !isMounted.current) {
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
    <AuthWrapper>
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
              <ScannerOverlay
                detectionStatus={detectionStatus}
                isCapturing={isCapturing || isUploading}
              />
            </CameraView>
          </Animated.View>
        </View>

        {/* Shortened bottom button container */}
        <View style={styles.buttonContainer}>
          <Animated.View
            entering={SlideInDown.duration(500).delay(200)}
            style={styles.captureButtonWrapper}
          >
            <CaptureButton
              onPress={handleCapture}
              isCapturing={isCapturing || isUploading}
              isReady={isFrameReady}
              size="compact" // Use compact size for the button
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    </AuthWrapper>
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
  buttonContainer: {
    // Reduced height from 150 to 100
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    // Reduced padding for devices with notches or home indicators
    paddingBottom: Platform.OS === "ios" ? 8 : 0,
  },
  captureButtonWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
});
