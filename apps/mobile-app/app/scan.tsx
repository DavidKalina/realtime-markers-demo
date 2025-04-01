// scan.tsx - Updated version with card-like UI styling
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import { ImageSelector } from "@/components/ImageSelector";
import { ScannerOverlay, ScannerOverlayRef } from "@/components/ScannerOverlay/ScannerOverlay";
import { ScannerAnimation, ScannerAnimationRef } from "@/components/ScannerAnimation";
import { useUserLocation } from "@/contexts/LocationContext";
import { useCamera } from "@/hooks/useCamera";
import { useEventBroker } from "@/hooks/useEventBroker";
import apiClient from "@/services/ApiClient";
import { EventTypes } from "@/services/EventBroker";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { Feather } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, SlideInDown, SlideInRight } from "react-native-reanimated";

type DetectionStatus = "none" | "detecting" | "aligned";
type ImageSource = "camera" | "gallery" | null;

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
  const detectionIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("none");
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<ImageSource>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const isMounted = useRef(true);

  const { userLocation } = useUserLocation();

  // Navigation timer ref
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Access job queue store directly
  const addJob = useJobSessionStore((state) => state.addJob);

  // Get the event broker
  const { publish } = useEventBroker();

  // Refs for animation components
  const scannerOverlayRef = useRef<ScannerOverlayRef>(null);
  const scannerAnimationRef = useRef<ScannerAnimationRef>(null);

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

  // Document detection simulation
  const startDocumentDetection = useCallback(() => {
    clearDetectionInterval();

    if (!isCameraActive || !isCameraReady || !isMounted.current) return;

    let counter = 0;

    const interval = setInterval(() => {
      if (!isMounted.current || !isCameraActive || !isCameraReady) {
        clearInterval(interval);
        return;
      }

      counter++;

      // Simplified detection logic
      if (counter < 3) {
        setDetectionStatus("none");
        setIsFrameReady(false);
      } else if (counter < 5) {
        setDetectionStatus("detecting");
        setIsFrameReady(false);
      } else {
        setDetectionStatus("aligned");
        setIsFrameReady(true);
      }
    }, 500);

    detectionIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [isCameraActive, isCameraReady, clearDetectionInterval]);

  // Start detection when camera becomes active and ready
  useEffect(() => {
    if (!isMounted.current) return;

    if (isCameraActive && isCameraReady && !isCapturing && !isUploading && !capturedImage) {
      startDocumentDetection();
    } else {
      clearDetectionInterval();
    }

    return clearDetectionInterval;
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

    // Clear all intervals
    clearDetectionInterval();

    // Clear navigation timer
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }

    // Reset all state
    setDetectionStatus("none");
    setIsFrameReady(false);
    setIsUploading(false);
    setCapturedImage(null);
    setImageSource(null);
    setUploadProgress(0);

    // Clean up animations
    scannerOverlayRef.current?.cleanup();
    scannerAnimationRef.current?.cleanup();

    // Release camera resources
    releaseCamera();
  }, [clearDetectionInterval, releaseCamera]);

  // Back button handler with enhanced cleanup
  const handleBack = () => {
    if (!isMounted.current) return;

    // Perform full cleanup
    performFullCleanup();

    // Ensure all cleanup operations are completed before navigation
    Promise.resolve().then(() => {
      if (isMounted.current) {
        router.replace("/");
      }
    });
  };

  // Enhanced cleanup effect
  useEffect(() => {
    return () => {
      isMounted.current = false;
      performFullCleanup();
    };
  }, [performFullCleanup]);

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

  // Updated uploadImageAndQueue function to handle both camera and gallery sources
  const uploadImageAndQueue = async (uri: string) => {
    if (!isMounted.current) return null;

    try {
      setUploadProgress(10);

      // Process/compress the image before uploading
      const processedUri = await processImage(uri);

      setUploadProgress(30);

      // Create imageFile object for apiClient
      const imageFile = {
        uri: processedUri || uri, // Fallback to original if processing failed
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

      setUploadProgress(70);

      // Upload using API client - this handles FormData internally
      const result = await apiClient.processEventImage(imageFile);

      setUploadProgress(100);

      if (result.jobId && isMounted.current) {
        queueJobAndNavigateDelayed(result.jobId);
        return result.jobId;
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      console.error("Upload failed:", error);

      if (isMounted.current) {
        publish(EventTypes.ERROR_OCCURRED, {
          timestamp: Date.now(),
          source: "ScanScreen",
          error: `Failed to upload image: ${error}`,
        });

        // Show error to user
        Alert.alert(
          "Upload Failed",
          "There was a problem uploading your document. Please try again.",
          [{ text: "OK" }]
        );
      }

      throw error;
    } finally {
      if (isMounted.current) {
        setUploadProgress(0);
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

  // Handle image capture - improved with better error handling
  const handleCapture = async () => {
    if (!isMounted.current) return;

    if (!cameraRef.current) {
      return;
    }

    if (!isCameraReady) {
      // Show notification to the user
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Camera is initializing, please try again in a moment.",
      });

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

      // Upload the image and process
      await uploadImageAndQueue(photoUri);
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

  // Handle image selection from gallery
  const handleImageSelected = async (uri: string) => {
    if (!isMounted.current) return;

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

// Fix React Native warning about string percentages in styles
const getProgressBarWidth = (progress: number) => {
  return {
    width: `${progress}%`,
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
    backgroundColor: "#333",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  contentArea: {
    flex: 1,
    padding: 8, // Reduced padding to maximize space
  },
  flexContainer: {
    flex: 1,
    padding: 16,
  },
  cameraCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 8,
  },
  camera: {
    flex: 1,
  },
  cameraNotReadyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraNotReadyText: {
    color: "#ffffff",
    marginTop: 16,
    fontFamily: "SpaceMono",
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  cameraPlaceholderText: {
    color: "#f8f9fa",
    marginTop: 16,
    fontFamily: "SpaceMono",
  },

  previewImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    resizeMode: "contain",
    backgroundColor: "#1a1a1a",
  },
  progressContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  controlsPlaceholder: {
    height: 80, // Reduced height to match new controls height
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#93c5fd",
    borderRadius: 2,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    color: "#f8f9fa",
    marginTop: 16,
    fontFamily: "SpaceMono",
  },
});
