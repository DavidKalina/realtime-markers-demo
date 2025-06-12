// scan.tsx - Refactored to use Screen.tsx pattern
import { AuthWrapper } from "@/components/AuthWrapper";
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import Screen from "@/components/Layout/Screen";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { useUserLocation } from "@/contexts/LocationContext";
import { useCamera } from "@/hooks/useCamera";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { apiClient, PlanType } from "@/services/ApiClient";
import { EventTypes } from "@/services/EventBroker";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

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
    checkPermission,
  } = useCamera();

  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [imageSource, setImageSource] = useState<ImageSource>(null);
  const isMounted = useRef(true);

  const { userLocation } = useUserLocation();
  const networkState = useNetworkQuality();
  const uploadRetryCount = useRef(0);
  const MAX_RETRIES = 3;

  // Navigation timer ref
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the event broker
  const { publish } = useEventBroker();

  const [planDetails, setPlanDetails] = useState<{
    planType: PlanType;
    weeklyScanCount: number;
    scanLimit: number;
    remainingScans: number;
    lastReset: Date | null;
  } | null>(null);
  const [isCheckingPlan, setIsCheckingPlan] = useState(true);

  // New state to control when to show no-scans overlay
  const [showNoScansOverlay, setShowNoScansOverlay] = useState(false);

  // New state to control processing overlay
  const [showProcessingOverlay, setShowProcessingOverlay] = useState(false);

  // New state to store the captured image URI for processing overlay
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  // New state to control the processing flow stages
  const [processingStage, setProcessingStage] = useState<
    "captured" | "uploading" | "success" | null
  >(null);

  // Temporary simulation function for testing in simulator
  const simulateCapture = useCallback(() => {
    if (!isMounted.current) return;

    // Use a reliable sample image URL for simulation
    // This is a simple placeholder image that should work in simulators
    const sampleImageUri =
      "https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Sample+Document";

    // Alternative: Create a simple colored background as fallback
    // const sampleImageUri = null; // This will show just the processing overlay without image

    setCapturedImageUri(sampleImageUri);
    setProcessingStage("captured");
    setShowProcessingOverlay(true);
    setImageSource("camera");

    // Show a notification
    publish(EventTypes.NOTIFICATION, {
      timestamp: Date.now(),
      source: "ScanScreen",
      message: "Simulating document capture...",
    });

    // Simulate the full flow with proper timing
    setTimeout(() => {
      if (isMounted.current) {
        setProcessingStage("uploading");
        setIsUploading(true);

        publish(EventTypes.NOTIFICATION, {
          timestamp: Date.now(),
          source: "ScanScreen",
          message: "Simulating document processing...",
        });
      }
    }, 2000);

    setTimeout(() => {
      if (isMounted.current) {
        setProcessingStage("success");
        setIsUploading(false);

        publish(EventTypes.NOTIFICATION, {
          timestamp: Date.now(),
          source: "ScanScreen",
          message: "Simulation completed successfully!",
        });
      }
    }, 4000);

    setTimeout(() => {
      if (isMounted.current) {
        // Don't manually hide overlay - let navigateToJobs handle the fade-out
        setCapturedImageUri(null);
        setProcessingStage(null);
        setImageSource(null);
        setIsUploading(false);

        // Navigate to jobs screen
        console.log("[ScanScreen] Simulation: About to navigate to jobs");
        navigateToJobs();
      }
    }, 5500);
  }, [publish]);

  // Set mounted flag to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  // Enhanced cleanup function
  const performFullCleanup = useCallback(() => {
    if (!isMounted.current) return;

    // Clear navigation timer
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }

    // Reset all state first
    setIsUploading(false);
    setImageSource(null);
    setShowProcessingOverlay(false);
    setCapturedImageUri(null);
    setProcessingStage(null);
    uploadRetryCount.current = 0;

    // Release camera resources last to avoid conflicts
    setTimeout(() => {
      if (isMounted.current) {
        releaseCamera();
      }
    }, 100);
  }, [releaseCamera]);

  // Handle screen focus changes
  useFocusEffect(
    useCallback(() => {
      return () => {
        performFullCleanup();
      };
    }, [performFullCleanup]),
  );

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        performFullCleanup();
      }
    });

    return () => {
      subscription.remove();
      performFullCleanup();
    };
  }, [performFullCleanup]);

  // Back button handler with enhanced cleanup
  const handleBack = useCallback(() => {
    if (!isMounted.current) return;
    performFullCleanup();
    router.replace("/");
  }, [performFullCleanup, router]);

  // Navigate to jobs screen after successful upload
  const navigateToJobs = useCallback(() => {
    console.log("[ScanScreen] navigateToJobs called");
    if (!isMounted.current) {
      console.log("[ScanScreen] Component not mounted, skipping navigation");
      return;
    }
    console.log("[ScanScreen] Navigating to jobs screen...");

    // Navigate directly without animation to avoid Reanimated conflicts
    router.push("/jobs");
    console.log("[ScanScreen] Navigation call completed");
  }, [router]);

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {};

      payload.imageFile = {
        uri: processedUri || uri,
        name: "image.jpg",
        type: "image/jpeg",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      // Add location data if available
      if (userLocation) {
        payload.userLat = userLocation[1].toString();
        payload.userLng = userLocation[0].toString();
      }

      // Add source information to track analytics
      payload.source = imageSource || "unknown";

      // Upload using API client
      const result = await apiClient.events.processEventImage({
        imageFile: payload.imageFile,
        userLat: payload.userLat,
        userLng: payload.userLng,
        source: payload.source,
      });

      if (result.jobId && isMounted.current) {
        console.log("[ScanScreen] Upload successful, job ID:", result.jobId);
        // Publish job queued event
        publish(EventTypes.JOB_QUEUED, {
          timestamp: Date.now(),
          source: "ScanScreen",
          jobId: result.jobId,
          message: "Document scan queued for processing",
        });

        // Return the job ID - navigation will be handled by the calling function
        return result.jobId;
      } else {
        console.log("[ScanScreen] No job ID returned from upload");
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
        await new Promise((resolve) => setTimeout(resolve, 2000));
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
          [{ text: "OK" }],
        );

        // Reset processing state on error
        setShowProcessingOverlay(false);
        setCapturedImageUri(null);
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
        // Camera will be ready automatically
      }
    }, 500);
  }, []);

  // Fetch plan details
  useEffect(() => {
    let isMounted = true;

    const fetchPlanDetails = async () => {
      try {
        const details = await apiClient.plans.getPlanDetails();
        if (isMounted) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPlanDetails(details as any);

          // Show no scans overlay if user has no more scans
          if (details && details.remainingScans <= 0) {
            setShowNoScansOverlay(true);
          }
        }
      } catch (error) {
        console.error("Error fetching plan details:", error);
      } finally {
        if (isMounted) {
          setIsCheckingPlan(false);
        }
      }
    };

    fetchPlanDetails();

    return () => {
      isMounted = false;
    };
  }, []);

  // Check if user has remaining scans
  const hasRemainingScans = useMemo(() => {
    if (!planDetails) return true;
    return planDetails.remainingScans > 0;
  }, [planDetails]);

  // Update handleCapture to check remaining scans
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

    // Check remaining scans
    if (!hasRemainingScans) {
      setShowNoScansOverlay(true);
      return;
    }

    // Check network before starting capture process
    if (!isNetworkSuitable()) {
      Alert.alert(
        "Poor Network Connection",
        "Please ensure you have a stable network connection before capturing.",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      // Take picture
      const photoUri = await takePicture();

      if (!photoUri || !isMounted.current) {
        throw new Error("Failed to capture image");
      }

      // Store the captured image URI for the processing overlay
      setCapturedImageUri(photoUri);

      // Show captured image first (stage 1)
      setProcessingStage("captured");
      setShowProcessingOverlay(true);
      setImageSource("camera");

      // Show a notification
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Image captured successfully!",
      });

      // Wait 2 seconds to let user see their captured image
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (!isMounted.current) return;

      // Start upload process (stage 2)
      setProcessingStage("uploading");
      setIsUploading(true);

      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Processing document...",
      });

      // Upload the image
      console.log("[ScanScreen] handleCapture: Starting upload...");
      await uploadImageAndQueue(photoUri);
      console.log("[ScanScreen] handleCapture: Upload completed");

      if (!isMounted.current) return;

      // Show success state (stage 3)
      console.log("[ScanScreen] handleCapture: Showing success state");
      setProcessingStage("success");

      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Document processed successfully!",
      });

      // Wait 1.5 seconds to show success state
      console.log("[ScanScreen] handleCapture: Waiting 1.5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!isMounted.current) return;

      // Navigate to jobs screen
      console.log("[ScanScreen] handleCapture: About to navigate to jobs");
      navigateToJobs();
    } catch (error) {
      console.error("Capture failed:", error);

      if (isMounted.current) {
        Alert.alert(
          "Operation Failed",
          "Failed to process the document. Please try again.",
          [{ text: "OK" }],
        );

        setImageSource(null);
        setIsUploading(false);
        setShowProcessingOverlay(false);
        setCapturedImageUri(null);
        setProcessingStage(null);
      }
    }
  };

  // Update handleImageSelected to check remaining scans
  const handleImageSelected = async (uri: string) => {
    if (!isMounted.current) return;

    // Check remaining scans
    if (!hasRemainingScans) {
      setShowNoScansOverlay(true);
      return;
    }

    // Check network before starting gallery image process
    if (!isNetworkSuitable()) {
      Alert.alert(
        "Poor Network Connection",
        "Please ensure you have a stable network connection before selecting an image.",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      // Store the selected image URI for the processing overlay
      setCapturedImageUri(uri);

      // Show selected image first (stage 1)
      setProcessingStage("captured");
      setShowProcessingOverlay(true);
      setImageSource("gallery");

      // Show a notification
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Image selected successfully!",
      });

      // Wait 2 seconds to let user see their selected image
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (!isMounted.current) return;

      // Start upload process (stage 2)
      setProcessingStage("uploading");
      setIsUploading(true);

      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Processing document from gallery...",
      });

      // Upload the image and process
      await uploadImageAndQueue(uri);

      if (!isMounted.current) return;

      // Show success state (stage 3)
      setProcessingStage("success");

      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Document processed successfully!",
      });

      // Wait 1.5 seconds to show success state
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!isMounted.current) return;

      // Navigate to jobs screen
      console.log(
        "[ScanScreen] handleImageSelected: About to navigate to jobs",
      );
      navigateToJobs();
    } catch (error) {
      console.error("Gallery image processing failed:", error);

      if (isMounted.current) {
        Alert.alert(
          "Operation Failed",
          "Failed to process the selected image. Please try again.",
          [{ text: "OK" }],
        );

        setImageSource(null);
        setIsUploading(false);
        setShowProcessingOverlay(false);
        setCapturedImageUri(null);
        setProcessingStage(null);
      }
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
      <Screen
        bannerTitle="Scan Document"
        showBackButton={false}
        isScrollable={false}
        noSafeArea={false}
      >
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loaderText}>Checking camera permissions...</Text>
        </View>
      </Screen>
    );
  }

  // Loading state while checking plan details
  if (isCheckingPlan) {
    return (
      <Screen
        bannerTitle="Scan Document"
        showBackButton={false}
        isScrollable={false}
        noSafeArea={false}
      >
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loaderText}>Checking scan limits...</Text>
        </View>
      </Screen>
    );
  }

  // Main camera view
  return (
    <AuthWrapper>
      <Screen
        bannerEmoji="📸"
        bannerTitle="Scan"
        onBack={handleBack}
        isScrollable={false}
        noSafeArea={false}
      >
        {/* Camera container with fixed dimensions */}
        <View style={styles.contentArea}>
          <Animated.View
            style={styles.cameraCard}
            entering={FadeIn.duration(300)}
          >
            {isCameraActive ? (
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                onCameraReady={onCameraReady}
                flash={flashMode}
              >
                {/* Processing Overlay */}
                {showProcessingOverlay && (
                  <Animated.View
                    style={styles.processingOverlay}
                    entering={FadeIn.duration(300)}
                  >
                    {/* Background Image */}
                    {capturedImageUri && (
                      <Image
                        source={{ uri: capturedImageUri }}
                        style={styles.processingBackgroundImage}
                        resizeMode="cover"
                      />
                    )}
                    {/* Fullscreen dark overlay for contrast */}
                    <View style={styles.processingDarkLayer} />
                    {/* Centered content based on processing stage */}
                    <View style={styles.processingCenterContent}>
                      {processingStage === "captured" && (
                        <>
                          <Text style={styles.processingTitleStrong}>
                            Image Captured!
                          </Text>
                          <Text style={styles.processingMessageStrong}>
                            Your document has been captured successfully.
                          </Text>
                          <ActivityIndicator
                            size="large"
                            color={COLORS.accent}
                            style={{ marginTop: 24 }}
                          />
                        </>
                      )}
                      {processingStage === "uploading" && (
                        <>
                          <ActivityIndicator
                            size="large"
                            color={COLORS.accent}
                            style={{ marginBottom: 24 }}
                          />
                          <Text style={styles.processingTitleStrong}>
                            Processing Document
                          </Text>
                          <Text style={styles.processingMessageStrong}>
                            Please wait while we analyze your document...
                          </Text>
                        </>
                      )}
                      {processingStage === "success" && (
                        <>
                          <Text style={styles.successEmoji}>✅</Text>
                          <Text style={styles.processingTitleStrong}>
                            Success!
                          </Text>
                          <Text style={styles.processingMessageStrong}>
                            Your document has been processed successfully.
                          </Text>
                        </>
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* Camera not ready indicator */}
                {!isCameraReady && !showProcessingOverlay && (
                  <View style={styles.cameraNotReadyOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.cameraNotReadyText}>
                      Initializing camera...
                    </Text>
                  </View>
                )}

                {/* No Scans Available Overlay */}
                {showNoScansOverlay && !showProcessingOverlay && (
                  <Animated.View
                    style={styles.noScansOverlay}
                    entering={FadeIn.duration(300)}
                  >
                    <View style={styles.noScansContent}>
                      <View style={styles.noScansIconContainer}>
                        <Feather
                          name="alert-triangle"
                          size={32}
                          color={COLORS.warningText}
                        />
                      </View>
                      <Text style={styles.noScansTitle}>
                        Scan Limit Reached
                      </Text>
                      <Text style={styles.noScansMessage}>
                        You've used all your weekly scans. Upgrade to Pro for
                        unlimited scans.
                      </Text>
                      <TouchableOpacity
                        style={styles.upgradeButton}
                        onPress={() => {}}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.upgradeButtonText}>
                          Upgrade to Pro
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dismissButton}
                        onPress={() => setShowNoScansOverlay(false)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dismissButtonText}>Dismiss</Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                )}
              </CameraView>
            ) : (
              <View style={styles.cameraPlaceholder}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.cameraPlaceholderText}>
                  Initializing camera...
                </Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Fixed height container for controls */}
        <View style={styles.controlsContainer}>
          <CameraControls
            onCapture={handleCapture}
            onImageSelected={handleImageSelected}
            isCapturing={isCapturing || isUploading}
            isReady={isCameraReady}
            flashMode={flashMode}
            onFlashToggle={toggleFlash}
            disabled={
              !isCameraReady ||
              isUploading ||
              !hasRemainingScans ||
              showProcessingOverlay
            }
          />

          {/* Simulation button for testing in development */}
          {__DEV__ && !showProcessingOverlay && (
            <TouchableOpacity
              style={styles.simulationButton}
              onPress={simulateCapture}
              activeOpacity={0.7}
            >
              <Text style={styles.simulationButtonText}>
                🧪 Simulate Capture (Dev Only)
              </Text>
            </TouchableOpacity>
          )}

          {/* Subtle scan counter badge */}
          {planDetails && hasRemainingScans && !showProcessingOverlay && (
            <Animated.View
              style={styles.scanCountBadge}
              entering={FadeIn.duration(300)}
            >
              <Text style={styles.scanCountText}>
                {planDetails.remainingScans} scan
                {planDetails.remainingScans !== 1 ? "s" : ""} left
              </Text>
            </Animated.View>
          )}
        </View>
      </Screen>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    padding: 8,
    minHeight: 400,
  },
  cameraCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.cardBackground,
    shadowColor: COLORS.shadow,
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
  controlsContainer: {
    paddingBottom: 16,
    position: "relative",
  },
  scanCountBadge: {
    position: "absolute",
    bottom: 8,
    right: 16,
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  scanCountText: {
    color: COLORS.cardBackground,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  noScansOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 100,
  },
  noScansContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  noScansIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.warningBackground,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  noScansTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "SpaceMono",
    marginBottom: 8,
    textAlign: "center",
  },
  noScansMessage: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  dismissButton: {
    backgroundColor: COLORS.buttonBackground,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  dismissButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  processingBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  processingDarkLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  processingCenterContent: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  processingTitleStrong: {
    color: "#000000",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "SpaceMono",
    marginBottom: 8,
    textAlign: "center",
  },
  processingMessageStrong: {
    color: "#333333",
    fontSize: 14,
    textAlign: "center",
    fontFamily: "SpaceMono",
    marginBottom: 24,
    lineHeight: 20,
  },
  simulationButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  simulationButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
});
