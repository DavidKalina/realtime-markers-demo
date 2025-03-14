// scan.tsx - Modified version
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton/CaptureButton";
import { ScannerOverlay } from "@/components/ScannerOverlay/ScannerOverlay";
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
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { useUserLocation } from "@/contexts/LocationContext";
import { ScannerAnimation } from "@/components/ScannerAnimation";

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
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
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

  // Get job ID and queue for processing
  const uploadImageAndQueue = async (uri: string) => {
    if (!isMounted.current) return null;

    try {
      const imageFile = {
        uri,
        name: "image.jpg",
        type: "image/jpeg",
      } as any;

      if (userLocation) {
        imageFile.userLng = userLocation[0].toString();
        imageFile.userLat = userLocation[1].toString();
      }

      const result = await apiClient.processEventImage(imageFile);

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
      }

      throw error;
    }
  };

  // Handle camera permission
  const handlePermissionGranted = useCallback(() => {
    // Nothing special needed
  }, []);

  // Handle image capture
  const handleCapture = async () => {
    if (!isMounted.current || !cameraRef.current || !isCameraReady) return;

    try {
      // Stop detection while capturing
      clearDetectionInterval();

      console.log("Taking picture...");
      // Use the camera reference directly to take the picture with proper type assertion
      const photo = await (cameraRef.current as any).takePictureAsync({
        quality: 0.8,
        exif: true,
      });

      console.log("Picture taken:", photo?.uri);

      if (!photo?.uri || !isMounted.current) {
        throw new Error("Failed to capture image");
      }

      // Show the captured image
      setCapturedImage(photo.uri);

      // Start upload process
      setIsUploading(true);

      // Show a notification
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Processing document...",
      });

      // Process the image to get job ID
      await uploadImageAndQueue(photo.uri);
    } catch (error) {
      console.error("Capture failed:", error);

      if (isMounted.current) {
        Alert.alert("Operation Failed", "Failed to process the document. Please try again.", [
          { text: "OK" },
        ]);

        setCapturedImage(null);
        setIsUploading(false);
        startDocumentDetection();
      }
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    if (!isMounted.current) return;

    setCapturedImage(null);
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

  // Handle camera permission request if needed
  if (!hasPermission) {
    return <CameraPermission onPermissionGranted={handlePermissionGranted} />;
  }

  // Image preview mode
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
          <Text style={styles.headerText}>Processing Document</Text>
        </Animated.View>

        {/* Image preview */}
        <View style={styles.flexContainer}>
          <Animated.View style={styles.previewContainer} entering={FadeIn.duration(300)}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />

            {/* Scanner animation overlay */}
            <View style={styles.scannerAnimationContainer}>
              <ScannerAnimation isActive={true} color="#37D05C" speed={1000} />
            </View>

            {/* Processing overlay */}
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#4dabf7" />
              <Text style={styles.processingText}>Processing document...</Text>
            </View>
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
          <CameraView ref={cameraRef} style={styles.camera} onCameraReady={onCameraReady}>
            <ScannerOverlay
              detectionStatus={detectionStatus}
              isCapturing={isCapturing || isUploading}
            />
          </CameraView>
        </Animated.View>
      </View>

      <View style={styles.buttonContainer}>
        <Animated.View
          entering={SlideInDown.duration(300).delay(200)}
          style={styles.captureButtonWrapper}
        >
          <CaptureButton
            onPress={handleCapture}
            isCapturing={isCapturing}
            isReady={true}
            size="compact"
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
  buttonContainer: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 8 : 0,
  },
  captureButtonWrapper: {
    justifyContent: "center",
    alignItems: "center",
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
  scannerAnimationContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  processingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  processingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 16,
    textAlign: "center",
  },
});
