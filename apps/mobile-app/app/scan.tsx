// scan.tsx - Updated version with file upload feature
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton/CaptureButton";
import { ImageSelector } from "@/components/ImageSelector";
import { ScannerOverlay } from "@/components/ScannerOverlay/ScannerOverlay";
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
      console.log("Starting document detection");
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
          // Clean up
          clearDetectionInterval();

          // Navigate back to the map
          router.replace("/");
        }
      }, 1500); // Show preview for 1.5 seconds
    },
    [addJob, publish, clearDetectionInterval, router]
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
    console.log("Permission granted callback");

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
      console.log("No camera ref available");
      return;
    }

    if (!isCameraReady) {
      console.log("Camera not ready, cannot capture");

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

      console.log("Taking picture...");

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
      console.log("Gallery image selected:", uri);

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

  // Back button handler
  const handleBack = () => {
    if (!isMounted.current) return;

    clearDetectionInterval();

    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
    }

    setTimeout(() => {
      if (isMounted.current) {
        releaseCamera();
        router.replace("/");
      }
    }, 50);
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
          <ActivityIndicator size="large" color="#f8f9fa" />
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
          <Text style={styles.headerText}>
            Processing {imageSource === "gallery" ? "Gallery Image" : "Document"}
          </Text>
        </Animated.View>

        {/* Image preview */}
        <View style={styles.flexContainer}>
          <Animated.View style={styles.previewContainer} entering={FadeIn.duration(300)}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />

            {/* Scanner overlay when processing */}
            <ScannerOverlay
              detectionStatus="aligned"
              isCapturing={true}
              guideText={`Processing ${
                imageSource === "gallery" ? "gallery image" : "document"
              }... ${uploadProgress > 0 ? `(${uploadProgress}%)` : ""}`}
              showScannerAnimation={true}
            />
          </Animated.View>
        </View>
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
        <Text style={styles.headerText}>Scan Document</Text>
      </Animated.View>

      {/* Camera container */}
      <View style={styles.flexContainer}>
        <Animated.View style={styles.cameraContainer} entering={FadeIn.duration(300)}>
          {isCameraActive ? (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              onCameraReady={onCameraReady}
              flash={flashMode}
            >
              <ScannerOverlay
                detectionStatus={detectionStatus}
                isCapturing={isCapturing || isUploading}
                showScannerAnimation={false}
                guideText={
                  isCameraReady
                    ? "Position your document within the frame"
                    : "Initializing camera..."
                }
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
              <ActivityIndicator size="large" color="#f8f9fa" />
              <Text style={styles.cameraPlaceholderText}>Initializing camera...</Text>
            </View>
          )}
        </Animated.View>
      </View>

      <View style={styles.buttonContainer}>
        {/* Gallery selection button */}
        <Animated.View
          entering={SlideInRight.duration(300).delay(100)}
          style={styles.gallerySelectorWrapper}
        >
          <ImageSelector
            onImageSelected={handleImageSelected}
            disabled={isCapturing || isUploading}
          />
        </Animated.View>

        {/* Capture button */}
        <Animated.View
          entering={SlideInDown.duration(300).delay(200)}
          style={styles.captureButtonWrapper}
        >
          <CaptureButton
            onPress={handleCapture}
            isCapturing={isCapturing}
            isReady={isCameraReady && detectionStatus === "aligned"}
            size="compact"
            flashMode={flashMode}
            onFlashToggle={toggleFlash}
            flashButtonPosition="left"
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
    backgroundColor: "#333",
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
    flex: 1,
    position: "relative",
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
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
  },
  cameraPlaceholderText: {
    color: "#f8f9fa",
    marginTop: 16,
    fontFamily: "SpaceMono",
  },
  buttonContainer: {
    height: 100,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 8 : 0,
  },
  captureButtonWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  gallerySelectorWrapper: {
    position: "absolute",
    right: 40,
    bottom: Platform.OS === "ios" ? 30 : 20,
  },
  // Preview mode styles
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  previewImage: {
    flex: 1,
    resizeMode: "contain",
  },
  // Loading state styles
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
