import { CameraPermission } from "@/components/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton";
import { EnhancedJobProcessor } from "@/components/JobProcessor";
import { MorphingLoader } from "@/components/MorphingLoader";
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
import { useFocusEffect } from "@react-navigation/native";

type DetectionStatus = "none" | "detecting" | "aligned";
type ProcessingStatus = "none" | "capturing" | "uploading" | "processing";

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

  // State for job tracking
  const [jobId, setJobId] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processingResult, setProcessingResult] = useState<any>(null);

  // Processing status state to show immediate feedback
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("none");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Camera initialization state - we're waiting for both permission and for camera to be ready
  const [isCameraInitializing, setIsCameraInitializing] = useState(true);

  // Clear detection interval function
  const clearDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // When we enter the screen, we may need to reinitialize
      if (!isCameraActive || !isCameraReady) {
        setIsCameraInitializing(true);

        // Add a backup timer to exit initialization state
        const backupTimer = setTimeout(() => {
          if (hasPermission === true) {
            console.log("Backup timer forcing exit from initialization state");
            setIsCameraInitializing(false);
          }
        }, 6000); // 6 second backup

        return () => clearTimeout(backupTimer);
      }

      return () => {
        // Clean up on unfocus
        clearDetectionInterval();
      };
    }, [isCameraActive, isCameraReady, hasPermission, clearDetectionInterval]) // Removed isCameraInitializing from dependencies
  );

  // Also add a master safety timer as a separate effect
  useEffect(() => {
    // This is a fallback safety mechanism to ensure we don't get stuck
    const masterSafetyTimer = setTimeout(() => {
      if (isCameraInitializing && hasPermission === true) {
        console.log("MASTER safety timeout triggered - forcing camera initialization complete");
        setIsCameraInitializing(false);
      }
    }, 10000); // 10 second master safety timeout

    return () => clearTimeout(masterSafetyTimer);
  }, [isCameraInitializing, hasPermission]);

  // Modified code:
  useEffect(() => {
    console.log("Camera initialization state check:", {
      hasPermission,
      isCameraReady,
      isCameraActive,
    });

    if (hasPermission && isCameraReady) {
      // Both permission granted and camera is ready
      setIsCameraInitializing(false);
    } else if (hasPermission === false) {
      // If permission is explicitly denied, we should not show loading
      setIsCameraInitializing(false);
    } else if (hasPermission === true && !isCameraReady && isCameraActive) {
      // Permission is granted, camera is active but not ready yet
      // Set a safety timeout to avoid being stuck in initializing state
      const safetyTimer = setTimeout(() => {
        console.log("Safety timeout triggered - forcing camera initialization complete");
        setIsCameraInitializing(false);
      }, 5000); // 5 second safety timeout

      return () => clearTimeout(safetyTimer);
    }
  }, [hasPermission, isCameraReady, isCameraActive]);

  // Setup mock document detection
  const startDocumentDetection = useCallback(() => {
    // Clear any existing interval first
    clearDetectionInterval();

    if (!isCameraActive || !isCameraReady) return;

    // Simulate varying detection confidence
    const interval = setInterval(() => {
      // Only process if component is still mounted and camera is active
      if (!isCameraActive || !isCameraReady) {
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
  }, [isCameraActive, isCameraReady, clearDetectionInterval]);

  // Start detection when camera becomes active and ready
  useEffect(() => {
    if (isCameraActive && isCameraReady && !isCapturing && processingStatus === "none") {
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
    isCameraReady,
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

  const handlePermissionGranted = useCallback(() => {
    console.log("Permission granted callback");
    // Force reset the initialization state when we get permission
    // This will let us re-evaluate in the effect above
    setIsCameraInitializing(true);
  }, []);

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

  // Don't render camera if we're not on this screen
  if (!isCameraActive && !isCameraInitializing) {
    return null;
  }

  // Show loading state while camera is initializing
  if (isCameraInitializing) {
    return (
      <View style={styles.container}>
        <Animated.View style={styles.processingContainer} entering={FadeIn.duration(500)}>
          <MorphingLoader size={80} color="#69db7c" />
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

  // Main camera view
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
  processingContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
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
