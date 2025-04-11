// scan.tsx - Updated version with card-like UI styling
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import { SimplifiedScannerAnimationRef } from "@/components/ScannerAnimation";
import { ScannerOverlay, ScannerOverlayRef } from "@/components/ScannerOverlay/ScannerOverlay";
import { useUserLocation } from "@/contexts/LocationContext";
import { useCamera } from "@/hooks/useCamera";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import apiClient from "@/services/ApiClient";
import { EventTypes } from "@/services/EventBroker";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { Feather } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { debounce } from "lodash";

type DetectionStatus = "none" | "detecting" | "aligned";
type ImageSource = "camera" | "gallery" | null;

// Unified color theme matching ClusterEventsView
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
};

export default function ScanScreen() {
  const {
    hasPermission,
    cameraRef,
    takePicture,
    processImage,
    isCapturing,
    isCameraActive,
    isCameraReady,
    onCameraReady,
    releaseCamera,
    flashMode,
    toggleFlash,
    permissionRequested,
    checkPermission,
  } = useCamera();

  const router = useRouter();
  const detectionIntervalRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("none");
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<ImageSource>(null);
  const isMounted = useRef(true);

  const { userLocation } = useUserLocation();
  const networkState = useNetworkQuality();
  const uploadRetryCount = useRef(0);
  const MAX_RETRIES = 3;

  // Navigation timer ref
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Access job queue store directly
  const addJob = useJobSessionStore((state) => state.addJob);

  // Get the event broker
  const { publish } = useEventBroker();

  // Refs for animation components
  const scannerOverlayRef = useRef<ScannerOverlayRef>(null);
  const scannerAnimationRef = useRef<SimplifiedScannerAnimationRef>(null);

  // Memoize the detection status handler to prevent unnecessary rerenders
  const handleDetectionStatus = useCallback((status: DetectionStatus) => {
    if (isMounted.current) {
      setDetectionStatus(status);
    }
  }, []);

  // Clear detection interval function
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
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  // Optimize document detection with requestAnimationFrame
  const startDocumentDetection = useCallback(() => {
    clearDetectionInterval();

    if (!isCameraActive || !isCameraReady || !isMounted.current) return;

    let counter = 0;
    let animationFrameId: number;

    const updateDetection = () => {
      if (!isMounted.current || !isCameraActive || !isCameraReady) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        return;
      }

      counter++;

      // Simplified detection logic
      if (counter < 3) {
        handleDetectionStatus("none");
      } else if (counter < 5) {
        handleDetectionStatus("detecting");
      } else {
        handleDetectionStatus("aligned");
      }

      animationFrameId = requestAnimationFrame(updateDetection);
    };

    animationFrameId = requestAnimationFrame(updateDetection);
    detectionIntervalRef.current = animationFrameId;

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isCameraActive, isCameraReady, clearDetectionInterval, handleDetectionStatus]);

  // Start detection when camera becomes active and ready
  useEffect(() => {
    if (!isMounted.current) return;

    if (isCameraActive && isCameraReady && !isCapturing && !isUploading && !capturedImage) {
      startDocumentDetection();
    } else {
      clearDetectionInterval();
    }

    return () => {
      clearDetectionInterval();
    };
  }, [
    isCameraActive,
    isCameraReady,
    isCapturing,
    isUploading,
    capturedImage,
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

  // Enhanced cleanup function
  const performFullCleanup = useCallback(() => {
    if (!isMounted.current) return;

    // Clear all intervals and timers
    clearDetectionInterval();

    // Clear navigation timer
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }

    // Reset all state
    setDetectionStatus("none");
    setIsUploading(false);
    setCapturedImage(null);
    setImageSource(null);
    uploadRetryCount.current = 0;

    // Clean up animations and refs
    if (scannerOverlayRef.current?.cleanup) {
      scannerOverlayRef.current.cleanup();
    }
    if (scannerAnimationRef.current?.cleanup) {
      scannerAnimationRef.current.cleanup();
    }

    // Release camera resources
    releaseCamera();
  }, [clearDetectionInterval, releaseCamera]);


  // Enhanced cleanup effect
  useEffect(() => {
    return () => {
      isMounted.current = false;
      performFullCleanup();
    };
  }, [performFullCleanup]);

  // Back button handler with enhanced cleanup
  const handleBack = () => {
    if (!isMounted.current) return;
    performFullCleanup();
    router.replace("/");
  };

  // Queue job and navigate after a brief delay
  const queueJobAndNavigateDelayed = useCallback(
    (jobId: string) => {
      if (!jobId || !isMounted.current) return;

      // Add to job queue
      addJob(jobId);

      // Publish job queued event
      publish(EventTypes.JOB_QUEUED, {
        timestamp: Date.now(),
        source: "ScanScreen",
        jobId: jobId,
        message: "Document scan queued for processing",
      });

      // Set a timer to navigate away after a brief preview
      navigationTimerRef.current = setTimeout(() => {
        if (isMounted.current) {
          // Perform full cleanup before navigation
          performFullCleanup();
          router.replace("/");
        }
      }, 1500);
    },
    [addJob, publish, performFullCleanup, router]
  );

  // Check if network is suitable for upload
  const isNetworkSuitable = useCallback(() => {
    if (!networkState.isConnected) return false;
    if (networkState.strength < 40) return false; // Reject if network strength is poor
    return true;
  }, [networkState.isConnected, networkState.strength]);

  // Updated uploadImageAndQueue function with retry logic
  const uploadImageAndQueue = async (uri: string) => {
    if (!isMounted.current) return null;

    try {
      // Check network before starting upload
      if (!isNetworkSuitable()) {
        throw new Error("Network connection is too weak for upload");
      }


      // Process/compress the image before uploading
      const processedUri = await processImage(uri);


      // Create imageFile object for apiClient
      const imageFile = {
        uri: processedUri || uri,
        name: "image.jpg",
        type: "image/jpeg",
      } as any;

      // Add location data if available
      if (userLocation) {
        imageFile.userLat = userLocation[1].toString();
        imageFile.userLng = userLocation[0].toString();
      }

      // Add source information to track analytics
      imageFile.source = imageSource || "unknown";


      // Upload using API client
      const result = await apiClient.processEventImage(imageFile);


      if (result.jobId && isMounted.current) {
        queueJobAndNavigateDelayed(result.jobId);
        return result.jobId;
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      console.error("Upload failed:", error);

      // Retry logic for network-related errors
      if (uploadRetryCount.current < MAX_RETRIES && isNetworkSuitable()) {
        uploadRetryCount.current++;
        publish(EventTypes.NOTIFICATION, {
          timestamp: Date.now(),
          source: "ScanScreen",
          message: `Retrying upload (${uploadRetryCount.current}/${MAX_RETRIES})...`,
        });

        // Wait for network to stabilize before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return uploadImageAndQueue(uri);
      }

      if (isMounted.current) {
        publish(EventTypes.ERROR_OCCURRED, {
          timestamp: Date.now(),
          source: "ScanScreen",
          error: `Failed to upload image: ${error}`,
        });

        Alert.alert(
          "Upload Failed",
          "There was a problem uploading your document. Please check your network connection and try again.",
          [{ text: "OK" }]
        );
      }

      throw error;
    } finally {
      if (isMounted.current) {
        uploadRetryCount.current = 0;
      }
    }
  };

  // Handle camera permission granted
  const handlePermissionGranted = useCallback(() => {
    // Small delay to ensure camera is properly initialized
    setTimeout(() => {
      if (isMounted.current) {
        startDocumentDetection();
      }
    }, 500);
  }, [startDocumentDetection]);

  // Optimize image processing with debouncing
  const debouncedUpload = useCallback(
    debounce(async (uri: string) => {
      if (!isMounted.current) return;
      try {
        await uploadImageAndQueue(uri);
      } catch (error) {
        console.error("Debounced upload failed:", error);
      }
    }, 300),
    [uploadImageAndQueue]
  );

  // Update handleCapture to use debounced upload
  const handleCapture = async () => {
    if (!isMounted.current) return;

    if (!cameraRef.current) {
      return;
    }

    if (!isCameraReady) {
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Camera is initializing, please try again in a moment.",
      });
      return;
    }

    // Check network before starting capture process
    if (!isNetworkSuitable()) {
      Alert.alert(
        "Poor Network Connection",
        "Please ensure you have a stable network connection before capturing.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      // Stop detection while capturing
      clearDetectionInterval();

      // Take picture
      const photoUri = await takePicture();

      if (!photoUri || !isMounted.current) {
        throw new Error("Failed to capture image");
      }

      // Show the captured image
      setCapturedImage(photoUri);
      setImageSource("camera");

      // Start upload process
      setIsUploading(true);

      // Show a notification
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Processing document...",
      });

      // Use debounced upload
      await debouncedUpload(photoUri);
    } catch (error) {
      console.error("Capture failed:", error);

      if (isMounted.current) {
        Alert.alert("Operation Failed", "Failed to process the document. Please try again.", [
          { text: "OK" },
        ]);

        setCapturedImage(null);
        setImageSource(null);
        setIsUploading(false);
        startDocumentDetection();
      }
    }
  };

  // Update handleImageSelected to check network before starting
  const handleImageSelected = async (uri: string) => {
    if (!isMounted.current) return;

    // Check network before starting gallery image process
    if (!isNetworkSuitable()) {
      Alert.alert(
        "Poor Network Connection",
        "Please ensure you have a stable network connection before selecting an image.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      // Stop detection
      clearDetectionInterval();

      // Show the selected image
      setCapturedImage(uri);
      setImageSource("gallery");

      // Start upload process
      setIsUploading(true);

      // Show a notification
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Processing document from gallery...",
      });

      // Upload the image and process
      await uploadImageAndQueue(uri);
    } catch (error) {
      console.error("Gallery image processing failed:", error);

      if (isMounted.current) {
        Alert.alert("Operation Failed", "Failed to process the selected image. Please try again.", [
          { text: "OK" },
        ]);

        setCapturedImage(null);
        setImageSource(null);
        setIsUploading(false);

        // Restart camera if available
        if (isCameraActive && isCameraReady) {
          startDocumentDetection();
        }
      }
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    if (!isMounted.current) return;

    setCapturedImage(null);
    setImageSource(null);
    setIsUploading(false);

    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }

    // Restart detection
    if (isCameraActive && isCameraReady) {
      startDocumentDetection();
    }
  };

  // In your ScanScreen component
  const handleRetryPermission = useCallback(async (): Promise<boolean> => {
    return await checkPermission();
  }, [checkPermission]);

  // Handle camera permission request if needed
  if (hasPermission === false) {
    return (
      <CameraPermission
        onPermissionGranted={handlePermissionGranted}
        onRetryPermission={handleRetryPermission}
      />
    );
  }

  // Loading state while checking permissions
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loaderText}>Checking camera permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Image preview mode (for both camera captured and gallery selected images)
  if (capturedImage) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <Animated.View style={styles.header} entering={FadeIn.duration(300)}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleCancel}
            activeOpacity={0.7}
            disabled={isUploading}
          >
            <View style={styles.backButtonContainer}>
              <Feather name="x" size={20} color="#f8f9fa" />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Processing {imageSource === "gallery" ? "Gallery Image" : "Document"}
          </Text>

          <View style={styles.headerIconContainer}>
            <Feather name="file" size={20} color="#93c5fd" />
          </View>
        </Animated.View>

        {/* Content area - same structure as camera view for consistency */}
        <View style={styles.contentArea}>
          <Animated.View style={styles.cameraCard} entering={FadeIn.duration(300)}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />

            {/* Scanner overlay */}
            <ScannerOverlay
              detectionStatus="aligned"
              isCapturing={true}
              showScannerAnimation={true}
            />
          </Animated.View>
        </View>

        {/* Empty view to maintain same layout structure */}
        <View style={styles.controlsPlaceholder} />
      </SafeAreaView>
    );
  }

  // Main camera view
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View style={styles.header} entering={FadeIn.duration(300)}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <View style={styles.backButtonContainer}>
            <Feather name="arrow-left" size={20} color="#f8f9fa" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Document</Text>

        <View style={styles.headerIconContainer}>
          <Feather name="camera" size={20} color="#93c5fd" />
        </View>
      </Animated.View>

      {/* Camera container */}
      <View style={styles.contentArea}>
        <Animated.View style={styles.cameraCard} entering={FadeIn.duration(300)}>
          {isCameraActive ? (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              onCameraReady={onCameraReady}
              flash={flashMode}
            >
              <ScannerOverlay
                ref={scannerOverlayRef}
                detectionStatus={detectionStatus}
                isCapturing={isCapturing || isUploading}
                showScannerAnimation={false}
              />

              {/* Camera not ready indicator */}
              {!isCameraReady && (
                <View style={styles.cameraNotReadyOverlay}>
                  <ActivityIndicator size="large" color="#ffffff" />
                  <Text style={styles.cameraNotReadyText}>Initializing camera...</Text>
                </View>
              )}
            </CameraView>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <ActivityIndicator size="large" color="#93c5fd" />
              <Text style={styles.cameraPlaceholderText}>Initializing camera...</Text>
            </View>
          )}
        </Animated.View>
      </View>

      <CameraControls
        onCapture={handleCapture}
        onImageSelected={handleImageSelected}
        isCapturing={isCapturing || isUploading}
        isReady={isCameraReady && detectionStatus === "aligned"}
        flashMode={flashMode}
        onFlashToggle={toggleFlash}
        disabled={!isCameraReady || isUploading}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    flex: 1,
    letterSpacing: 0.5,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  contentArea: {
    flex: 1,
    padding: 8,
  },
  cameraCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.cardBackground,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderColor: COLORS.divider,
  },
  camera: {
    flex: 1,
  },
  cameraNotReadyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraNotReadyText: {
    color: COLORS.textPrimary,
    marginTop: 16,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  cameraPlaceholderText: {
    color: COLORS.textSecondary,
    marginTop: 16,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  previewImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    backgroundColor: COLORS.cardBackground,
  },
  progressContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  controlsPlaceholder: {
    height: 100,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    color: COLORS.textSecondary,
    marginTop: 16,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
});
