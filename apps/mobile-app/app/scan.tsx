// scan.tsx - Updated version with removed detection logic
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import { useUserLocation } from "@/contexts/LocationContext";
import { useCamera } from "@/hooks/useCamera";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import apiClient, { PlanType } from "@/services/ApiClient";
import { EventTypes } from "@/services/EventBroker";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { Feather } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  AppState
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { debounce } from "lodash";
import { useFocusEffect } from '@react-navigation/native';
import { ImagePoofIntoEmojiTransformation } from "@/components/ImagePoofIntoEmojiTransformation/ImagePoofIntoEmojiTransformation";

type ImageSource = "camera" | "gallery" | null;

// Unified color theme matching ClusterEventsView
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
  warningBackground: "rgba(253, 186, 116, 0.1)",
  warningBorder: "rgba(253, 186, 116, 0.3)",
  warningText: "#fdba74",
  errorBackground: "rgba(248, 113, 113, 0.1)",
  errorBorder: "rgba(248, 113, 113, 0.3)",
  errorText: "#f87171",
};

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
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<ImageSource>(null);
  const isMounted = useRef(true);

  const { userLocation } = useUserLocation();
  const networkState = useNetworkQuality();
  const uploadRetryCount = useRef(0);
  const MAX_RETRIES = 3;

  // Navigation timer ref
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Access job queue store directly
  const addJob = useJobSessionStore((state) => state.addJob);

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

    // Reset all state
    setIsUploading(false);
    setCapturedImage(null);
    setImageSource(null);
    uploadRetryCount.current = 0;

    // Release camera resources
    releaseCamera();
  }, [releaseCamera]);

  // Handle screen focus changes
  useFocusEffect(
    useCallback(() => {
      return () => {
        performFullCleanup();
      };
    }, [performFullCleanup])
  );

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        performFullCleanup();
      }
    });

    return () => {
      subscription.remove();
      performFullCleanup();
    };
  }, [performFullCleanup]);

  // Handle cancellation with cleanup
  const handleCancel = useCallback(() => {
    if (!isMounted.current) return;
    performFullCleanup();
  }, [performFullCleanup]);

  // Back button handler with enhanced cleanup
  const handleBack = useCallback(() => {
    if (!isMounted.current) return;
    performFullCleanup();
    router.replace("/");
  }, [performFullCleanup, router]);

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

      // Create imageFile object for apiClient
      const imageFile = {
        uri: processedUri || uri,
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

      // Upload using API client
      const result = await apiClient.processEventImage(imageFile);

      if (result.jobId && isMounted.current) {
        queueJobAndNavigateDelayed(result.jobId);
        return result.jobId;
      } else {
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
        await new Promise(resolve => setTimeout(resolve, 2000));
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
          [{ text: "OK" }]
        );
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

  // Optimize image processing with debouncing
  const debouncedUpload = useCallback(
    debounce(async (uri: string) => {
      if (!isMounted.current) return;
      try {
        await uploadImageAndQueue(uri);
      } catch (error) {
        console.error("Debounced upload failed:", error);
      }
    }, 300),
    [uploadImageAndQueue]
  );

  // Fetch plan details
  useEffect(() => {
    let isMounted = true;

    const fetchPlanDetails = async () => {
      try {
        const details = await apiClient.getPlanDetails();
        if (isMounted) {
          setPlanDetails(details);

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

  const handleUpgrade = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const response = await apiClient.createStripeCheckoutSession();

      if (!response.checkoutUrl) {
        throw new Error("No checkout URL received");
      }

      // Open the checkout URL in a WebView
      router.push({
        pathname: "/checkout",
        params: { checkoutUrl: response.checkoutUrl },
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };


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
        [{ text: "OK" }]
      );
      return;
    }

    try {
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

      // Wait for 2 seconds to ensure animation plays
      // Add safety check to ensure we still have the image
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Double check we still have the image and component is mounted
      if (!isMounted.current || !photoUri) {
        throw new Error("Scan cancelled or image lost");
      }

      // Recheck network before proceeding with upload
      if (!isNetworkSuitable()) {
        throw new Error("Network connection lost during scan");
      }

      // Use debounced upload
      await debouncedUpload(photoUri);
    } catch (error) {
      console.error("Capture failed:", error);

      if (isMounted.current) {
        Alert.alert("Operation Failed", "Failed to process the document. Please try again.", [
          { text: "OK" },
        ]);

        setCapturedImage(null);
        setImageSource(null);
        setIsUploading(false);
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
        [{ text: "OK" }]
      );
      return;
    }

    try {
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loaderText}>Checking camera permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state while checking plan details
  if (isCheckingPlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loaderText}>Checking scan limits...</Text>
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

        {/* Content area with transformation animation */}
        <View style={styles.contentArea}>
          <ImagePoofIntoEmojiTransformation
            imageUri={capturedImage}
            onAnimationComplete={async () => {
              try {
                await uploadImageAndQueue(capturedImage);
              } catch (error) {
                console.error("Upload failed after animation:", error);
                if (isMounted.current) {
                  Alert.alert(
                    "Upload Failed",
                    "There was a problem uploading your document. Please try again.",
                    [{ text: "OK" }]
                  );
                  setCapturedImage(null);
                  setImageSource(null);
                  setIsUploading(false);
                }
              }
            }}
          />
        </View>

        {/* Empty view to maintain same layout structure */}
        <View style={styles.controlsContainer} />
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

      {/* Camera container with fixed dimensions */}
      <View style={styles.contentArea}>
        <Animated.View style={styles.cameraCard} entering={FadeIn.duration(300)}>
          {isCameraActive ? (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              onCameraReady={onCameraReady}
              flash={flashMode}
            >
              {/* Camera not ready indicator */}
              {!isCameraReady && (
                <View style={styles.cameraNotReadyOverlay}>
                  <ActivityIndicator size="large" color="#ffffff" />
                  <Text style={styles.cameraNotReadyText}>Initializing camera...</Text>
                </View>
              )}

              {/* No Scans Available Overlay */}
              {showNoScansOverlay && (
                <Animated.View
                  style={styles.noScansOverlay}
                  entering={FadeIn.duration(300)}
                >
                  <View style={styles.noScansContent}>
                    <View style={styles.noScansIconContainer}>
                      <Feather name="alert-triangle" size={32} color={COLORS.warningText} />
                    </View>
                    <Text style={styles.noScansTitle}>Scan Limit Reached</Text>
                    <Text style={styles.noScansMessage}>
                      You've used all your weekly scans. Upgrade to Pro for unlimited scans.
                    </Text>
                    <TouchableOpacity
                      style={styles.upgradeButton}
                      onPress={handleUpgrade}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
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
              <ActivityIndicator size="large" color="#93c5fd" />
              <Text style={styles.cameraPlaceholderText}>Initializing camera...</Text>
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
          disabled={!isCameraReady || isUploading || !hasRemainingScans}
        />

        {/* Subtle scan counter badge */}
        {planDetails && hasRemainingScans && (
          <Animated.View
            style={styles.scanCountBadge}
            entering={FadeIn.duration(300)}
          >
            <Text style={styles.scanCountText}>
              {planDetails.remainingScans} scan{planDetails.remainingScans !== 1 ? 's' : ''} left
            </Text>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    flex: 1,
    letterSpacing: 0.5,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  contentArea: {
    flex: 1,
    padding: 8,
    minHeight: 400, // Ensure minimum height for camera view
  },
  cameraCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.cardBackground,
    shadowColor: "rgba(0, 0, 0, 0.5)",
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
  previewImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    backgroundColor: COLORS.cardBackground,
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
  // Subtle scan counter at bottom of screen
  scanCountBadge: {
    position: "absolute",
    bottom: 8,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  scanCountText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: "SpaceMono",
  },
  // No Scans Overlay
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
    shadowColor: "#000",
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
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  dismissButton: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  dismissButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
})