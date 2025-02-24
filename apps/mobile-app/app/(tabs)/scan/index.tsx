import React, { useState, useEffect, useCallback } from "react";
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
  const [hasPermission, setHasPermission] = useState(false);
  const { cameraRef, takePicture, isCapturing, isCameraActive } = useCamera();
  const router = useRouter();

  // Document detection state
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("none");
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [detectionInterval, setDetectionInterval] = useState<NodeJS.Timeout | null>(null);

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

  // Setup mock document detection
  // In a real app, replace this with actual frame analysis
  const startDocumentDetection = useCallback(() => {
    if (detectionInterval) {
      clearInterval(detectionInterval);
    }

    // Simulate varying detection confidence
    const interval: any = setInterval(() => {
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

    setDetectionInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Start detection when camera is active
  useEffect(() => {
    if (isCameraActive && !isCapturing && !isProcessing) {
      const cleanup = startDocumentDetection();

      return () => {
        cleanup();
        setDetectionStatus("none");
        setIsFrameReady(false);
      };
    }
  }, [isCameraActive, isCapturing, isProcessing]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
    };
  }, [detectionInterval]);

  const handleCapture = async () => {
    // Stop detection while capturing
    if (detectionInterval) {
      clearInterval(detectionInterval);
      setDetectionInterval(null);
    }

    const imageUri = await takePicture();
    if (imageUri) {
      await uploadImage(imageUri);
    }
  };

  const handleFrameReady = () => {
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

  // Handle camera permission request
  if (!hasPermission) {
    return <CameraPermission onPermissionGranted={() => setHasPermission(true)} />;
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/")}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Scan Document</Text>
      </Animated.View>

      <View style={styles.cameraWrapper}>
        <Animated.View style={styles.contentContainer} entering={FadeIn.duration(800)}>
          <CameraView ref={cameraRef} style={styles.camera}>
            <ScannerOverlay
              detectionStatus={detectionStatus}
              onFrameReady={handleFrameReady}
              guideText="Position your document within the frame"
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
    fontSize: 18,
    fontFamily: "BungeeInline",
    textAlign: "center",
    marginRight: 24, // To offset the back button width for perfect centering
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
    borderRadius: 10,
    overflow: "hidden",
    margin: 0,
  },
  camera: {
    flex: 1,
    borderRadius: 10,
  },
});
