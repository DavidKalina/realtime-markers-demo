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

  // Processing status state to show immediate feedback
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
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL!}/events/process`, {
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
    // Define comprehensive progress steps that cover the entire process
    const progressSteps = [
      "Initializing...",
      "Capturing...",
      "Processing...",
      "Uploading...",
      "Preparing...",
      "Analyzing...",
      "Extracting...",
      "Finalizing...",
    ];

    // Determine current step based on the processing status
    const currentStep =
      processingStatus === "capturing" ? 1 : processingStatus === "uploading" ? 3 : 0;

    return (
      <View style={styles.container}>
        <ImprovedProcessingView
          text={processingStatus === "capturing" ? "Capturing" : "Uploading"}
          progressSteps={progressSteps}
          currentStep={currentStep}
          isComplete={false}
          hasError={!!uploadError}
          errorMessage={uploadError || undefined}
          isCaptureState={processingStatus === "capturing"}
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
      {/* Refined Header */}
      <Animated.View style={styles.header} entering={FadeIn.duration(500)}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <View style={styles.backButtonContainer}>
            <Feather name="arrow-left" size={20} color="#f8f9fa" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerText}>Scan Document</Text>
      </Animated.View>

      <View style={styles.cameraWrapper}>
        <Animated.View style={styles.contentContainer} entering={FadeIn.duration(800)}>
          <CameraView ref={cameraRef} style={styles.camera} onCameraReady={onCameraReady}>
            <ScannerOverlay detectionStatus={detectionStatus} onFrameReady={handleFrameReady} />
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
  },
  backButton: {
    marginRight: 12,
  },
  backButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3a3a3a",
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    color: "#f8f9fa",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SpaceMono",
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
    color: "#f8f9fa",
    fontSize: 16,
    marginTop: 20,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  resetButton: {
    backgroundColor: "#4dabf7",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
});
