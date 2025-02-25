// ScanScreen.tsx - With JobProcessor integration
import React, { useRef, useState, useEffect, useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { CameraPermission } from "@/components/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton";
import { ScannerOverlay } from "@/components/ScannerOverlay";
import { SuccessScreen } from "@/components/SuccessScreen";
import { useCamera } from "@/hooks/useCamera";
import { CameraView } from "expo-camera";
import { EnhancedJobProcessor } from "@/components/JobProcessor";

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
  const detectionIntervalRef = useRef<NodeJS.Timer | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("none");
  const [isFrameReady, setIsFrameReady] = useState(false);

  // State for job tracking
  const [jobId, setJobId] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processingResult, setProcessingResult] = useState<any>(null);

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
    if (isCameraActive && !isCapturing && !jobId) {
      startDocumentDetection();
    } else {
      clearDetectionInterval();
    }

    // Clean up on unmount
    return () => {
      clearDetectionInterval();
    };
  }, [isCameraActive, isCapturing, jobId, startDocumentDetection, clearDetectionInterval]);

  // Clean up ALL resources on component unmount
  useEffect(() => {
    return () => {
      clearDetectionInterval();
      releaseCamera();
    };
  }, [clearDetectionInterval, releaseCamera]);

  const uploadImage = async (uri: string) => {
    try {
      // Create a FormData object to send the image
      const formData = new FormData();
      formData.append("image", {
        uri,
        name: "image.jpg",
        type: "image/jpeg",
      } as any);

      // Upload the image
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL!}/process`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          // Add any auth headers needed
        },
      });

      const result = await response.json();

      if (result.jobId) {
        // Store the job ID to start streaming updates
        setJobId(result.jobId);
        setImageUri(uri);
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      // Handle upload error
      alert("Failed to upload image. Please try again.");
      // If upload failed, restart detection
      startDocumentDetection();
    }
  };

  const handleCapture = async () => {
    // Stop detection while capturing
    clearDetectionInterval();

    const uri = await takePicture();
    if (uri) {
      await uploadImage(uri);
    } else {
      // If capture failed, restart detection
      startDocumentDetection();
    }
  };

  const handleFrameReady = () => {
    // Optional: Automatically trigger capture when frame is aligned
  };

  const handleJobComplete = (result: any) => {
    setProcessingResult(result);
  };

  const handleNewScan = () => {
    setJobId(null);
    setImageUri(null);
    setProcessingResult(null);
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

  // Show success screen after processing is complete
  if (processingResult && imageUri && processingResult.eventId) {
    return (
      <SuccessScreen
        imageUri={imageUri}
        onNewScan={handleNewScan}
        eventId={processingResult.eventId}
      />
    );
  }

  // Show job processor during processing
  if (jobId) {
    return (
      <EnhancedJobProcessor jobId={jobId} onComplete={handleJobComplete} onReset={handleNewScan} />
    );
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
            <ScannerOverlay onFrameReady={handleFrameReady} />
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
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  backButton: {
    padding: 8,
  },
  headerText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 16,
  },
  cameraWrapper: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: "#FFF",
    fontSize: 18,
    marginTop: 24,
    marginBottom: 32,
    textAlign: "center",
  },
  tryAgainButton: {
    backgroundColor: "#2f9e44",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tryAgainButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
