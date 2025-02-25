// ScanScreen.tsx - With immediate loading state
import { CameraPermission } from "@/components/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton";
import { EnhancedJobProcessor } from "@/components/JobProcessor";
import { ImprovedProcessingView } from "@/components/ProcessingView";
import { ScannerOverlay } from "@/components/ScannerOverlay";
import { SuccessScreen } from "@/components/SuccessScreen";
import { useCamera } from "@/hooks/useCamera";
import { Feather } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

type DetectionStatus = "none" | "detecting" | "aligned";
type ProcessingStatus = "none" | "capturing" | "uploading" | "processing";

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

  // New processing status state to show immediate feedback
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("none");
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    if (isCameraActive && !isCapturing && processingStatus === "none") {
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
    isCapturing,
    processingStatus,
    startDocumentDetection,
    clearDetectionInterval,
  ]);

  // Clean up ALL resources on component unmount
  useEffect(() => {
    return () => {
      clearDetectionInterval();
      releaseCamera();
    };
  }, [clearDetectionInterval, releaseCamera]);

  const uploadImage = async (uri: string) => {
    try {
      setProcessingStatus("uploading");

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
        setProcessingStatus("processing");
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      // Handle upload error
      setUploadError("Failed to upload image. Please try again.");
      setProcessingStatus("none");
      // If upload failed, restart detection
      startDocumentDetection();
    }
  };

  const handleCapture = async () => {
    // Stop detection while capturing
    clearDetectionInterval();

    // Immediately show the processing state
    setProcessingStatus("capturing");
    setUploadError(null);

    try {
      const uri = await takePicture();
      if (uri) {
        setImageUri(uri);
        await uploadImage(uri);
      } else {
        throw new Error("Failed to capture image");
      }
    } catch (error) {
      console.error("Capture failed:", error);
      setUploadError("Failed to capture image. Please try again.");
      setProcessingStatus("none");
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
    setProcessingStatus("none");
    setUploadError(null);
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

  // Show job processor once we have a job ID
  if (jobId) {
    return (
      <EnhancedJobProcessor jobId={jobId} onComplete={handleJobComplete} onReset={handleNewScan} />
    );
  }

  // Show capturing/uploading UI while waiting for job ID
  if (processingStatus === "capturing" || processingStatus === "uploading") {
    return (
      <View style={styles.container}>
        <ImprovedProcessingView
          text={processingStatus === "capturing" ? "Capturing image..." : "Uploading image..."}
          progressSteps={[
            "Capturing image...",
            "Processing image...",
            "Uploading to server...",
            "Starting analysis...",
          ]}
          currentStep={processingStatus === "capturing" ? 0 : 2}
          isComplete={false}
          hasError={!!uploadError}
          errorMessage={uploadError || undefined}
        />

        {uploadError && (
          <TouchableOpacity style={styles.resetButton} onPress={handleNewScan}>
            <Text style={styles.resetButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
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
  resetButton: {
    backgroundColor: "#2f9e44",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    alignSelf: "center",
  },
  resetButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
