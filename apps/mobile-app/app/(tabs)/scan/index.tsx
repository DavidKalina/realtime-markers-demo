import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraPermission } from "@/components/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton";
import { SuccessScreen } from "@/components/SuccessScreen";
import { ScannerOverlay } from "@/components/ScannerOverlay";
import { useCamera } from "@/hooks/useCamera";
import { useImageUpload } from "@/hooks/useImageUpload";
import Animated, { FadeIn } from "react-native-reanimated";
import { DynamicProcessingView } from "@/components/ProcessingView";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// Document detection states
type DetectionStatus = "none" | "detecting" | "aligned";

export default function ScanScreen() {
  const {
    hasPermission,
    cameraRef,
    takePicture,
    isCapturing,
    isCameraActive,
    onCameraReady,
    releaseCamera,
  } = useCamera();

  const router = useRouter();

  // Use a ref for the interval to ensure it's properly cleaned up
  const detectionIntervalRef = useRef<NodeJS.Timer | null>(null);

  // Document detection state
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("none");
  const [isFrameReady, setIsFrameReady] = useState(false);

  const {
    uploadImage,
    isProcessing,
    processingStep,
    processingSteps,
    processedImageUri,
    isSuccess,
    eventId,
    resetUpload,
  } = useImageUpload();

  // Clear detection interval function
  const clearDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  // Setup mock document detection
  const startDocumentDetection = useCallback(() => {
    // Clear any existing interval first
    clearDetectionInterval();

    if (!isCameraActive) return;

    // Simulate varying detection confidence
    const interval = setInterval(() => {
      // Only process if component is still mounted and camera is active
      if (!isCameraActive) {
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
  }, [isCameraActive, clearDetectionInterval]);

  // Start detection when camera becomes active
  useEffect(() => {
    if (isCameraActive && !isCapturing && !isProcessing) {
      startDocumentDetection();
    } else {
      clearDetectionInterval();
    }

    // Clean up on unmount
    return () => {
      clearDetectionInterval();
    };
  }, [isCameraActive, isCapturing, isProcessing, startDocumentDetection, clearDetectionInterval]);

  // Clean up ALL resources on component unmount
  useEffect(() => {
    return () => {
      clearDetectionInterval();
      releaseCamera();
    };
  }, [clearDetectionInterval, releaseCamera]);

  const handleCapture = async () => {
    // Stop detection while capturing
    clearDetectionInterval();

    const imageUri = await takePicture();
    if (imageUri) {
      await uploadImage(imageUri);
    } else {
      // If capture failed, restart detection
      startDocumentDetection();
    }
  };

  const handleFrameReady = () => {
    console.log("frame");
    // Optional: Automatically trigger capture when frame is aligned
    // if you want auto-capture, uncomment:
    // if (!isCapturing && !isProcessing) {
    //   handleCapture();
    // }
  };

  const handleNewScan = () => {
    resetUpload();
    // Restart detection
    startDocumentDetection();
  };

  const handleBack = () => {
    // Ensure we clean up resources before navigating away
    clearDetectionInterval();
    releaseCamera();
    router.push("/");
  };

  // Handle camera permission request
  if (!hasPermission) {
    return <CameraPermission onPermissionGranted={() => {}} />;
  }

  // Don't render when not on this screen
  if (!isCameraActive) {
    return null;
  }

  // Show success screen after processing
  if (isSuccess && processedImageUri) {
    return (
      <SuccessScreen
        imageUri={processedImageUri}
        onNewScan={handleNewScan}
        eventId={eventId || undefined}
      />
    );
  }

  // Show dynamic processing view while uploading
  if (isProcessing) {
    return <DynamicProcessingView progressSteps={processingSteps} currentStep={processingStep} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={styles.header} entering={FadeIn.duration(500)}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Scan Document</Text>
      </Animated.View>

      <View style={styles.cameraWrapper}>
        <Animated.View style={styles.contentContainer} entering={FadeIn.duration(800)}>
          <CameraView ref={cameraRef} style={styles.camera} onCameraReady={onCameraReady}>
            <ScannerOverlay
              // detectionStatus={detectionStatus}
              onFrameReady={handleFrameReady}
              // guideText="Position your document within the frame"
            />
          </CameraView>
        </Animated.View>
      </View>

      <CaptureButton onPress={handleCapture} isCapturing={isCapturing} isReady={isFrameReady} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#333",
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    fontFamily: "mono",
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginRight: 24,
    letterSpacing: 0.5,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  cameraWrapper: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    margin: 0,
  },
  camera: {
    flex: 1,
    borderRadius: 10,
  },
});
