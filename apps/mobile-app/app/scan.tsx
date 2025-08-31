// scan.tsx - Refactored to use modular components
import { AuthWrapper } from "@/components/AuthWrapper";
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import Screen from "@/components/Layout/Screen";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { useCamera } from "@/hooks/useCamera";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { useFocusEffect } from "@react-navigation/native";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

// Import new modular components
import {
  ProcessingOverlay,
  NoScansOverlay,
  ContentTypeOverlay,
  SimulationButton,
  useScanState,
} from "@/components/Scan";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  EventTypes,
  NavigateToCivicEngagementEvent,
} from "@/services/EventBroker";
import { useUserLocation } from "@/contexts/LocationContext";

export default function ScanScreen() {
  const {
    hasPermission,
    cameraRef,
    takePicture,
    processImage,
    isCameraActive,
    isCameraReady,
    onCameraReady,
    flashMode,
    toggleFlash,
    checkPermission,
  } = useCamera();

  const router = useRouter();
  const isMounted = useRef(true);
  const networkState = useNetworkQuality();
  const { subscribe } = useEventBroker();
  const { userLocation } = useUserLocation();

  // Navigation callback - memoized to prevent re-renders
  const navigateToJobs = useCallback(() => {
    if (!isMounted.current) {
      return;
    }

    try {
      router.replace("/");
    } catch (error) {
      console.error("[ScanScreen] Navigation error:", error);
    }
  }, [router]);

  // Check if network is suitable for upload - memoized to prevent re-renders
  const isNetworkSuitable = useCallback(() => {
    const suitable = networkState.isConnected && networkState.strength >= 40;
    return suitable;
  }, [networkState.isConnected, networkState.strength]);

  // Use the new unified scan state hook
  const {
    // Capture state
    isCapturing: isScanCapturing,
    capturedImageUri,

    // Processing state
    isProcessing,
    processingStage,
    showProcessingOverlay,

    // Content type choice state
    showContentTypeOverlay,

    // Scan limits
    showNoScansOverlay,
    setShowNoScansOverlay,

    // Actions
    handleCapture,
    handleImageSelected,
    handleSelectEvent,
    handleSelectCivicEngagement,
    handleCancelContentType,
    reset,
    simulateCapture,
  } = useScanState({
    processImage,
    isNetworkSuitable,
    isMounted,
    onNavigateToJobs: navigateToJobs,
  });

  // Set mounted flag to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      reset();
    };
  }, [reset]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        console.log("[ScanScreen] App going to background/inactive");
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Back button handler
  const handleBack = useCallback(() => {
    if (!isMounted.current) return;
    reset();
    router.replace("/");
  }, [reset, router]);

  // Handle camera permission granted
  const handlePermissionGranted = useCallback(() => {
    // Small delay to ensure camera is properly initialized
    setTimeout(() => {
      if (isMounted.current) {
        // Camera will be ready automatically
      }
    }, 500);
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkPermission();
      return () => {
        console.log("[ScanScreen] Screen unfocused");
      };
    }, []),
  );
  // Handle retry permission
  const handleRetryPermission = useCallback(async (): Promise<boolean> => {
    return await checkPermission();
  }, [checkPermission]);

  // Handle capture with proper error handling
  const onCapture = useCallback(async () => {
    const result = await handleCapture(takePicture);
    if (result?.error === "no_scans") {
      setShowNoScansOverlay(true);
    }
  }, [handleCapture, takePicture, setShowNoScansOverlay]);

  // Handle image selection with proper error handling
  const onImageSelected = useCallback(
    async (uri: string) => {
      const result = await handleImageSelected(uri);
      if (result?.error === "no_scans") {
        setShowNoScansOverlay(true);
      }
    },
    [handleImageSelected, setShowNoScansOverlay],
  );

  // Handle civic engagement navigation
  const handleCivicEngagementNavigation = useCallback(
    (imageUri: string) => {
      const params: Record<string, string> = {
        imageUri: imageUri,
      };

      // Add coordinates if available
      if (userLocation) {
        params.latitude = userLocation[1].toString(); // latitude
        params.longitude = userLocation[0].toString(); // longitude
      } else {
        console.log(
          "[ScanScreen] No user location available, proceeding without coordinates",
        );
      }

      router.push({
        pathname: "/create-civic-engagement" as const,
        params,
      });
    },
    [router],
  );

  // Set up event listener for civic engagement navigation
  useEffect(() => {
    const unsubscribe = subscribe<NavigateToCivicEngagementEvent>(
      EventTypes.NAVIGATE_TO_CIVIC_ENGAGEMENT,
      (event) => {
        console.log(
          "[ScanScreen] Received NAVIGATE_TO_CIVIC_ENGAGEMENT event:",
          event,
        );
        handleCivicEngagementNavigation(event.imageUri);
      },
    );

    return unsubscribe;
  }, [subscribe, handleCivicEngagementNavigation]);

  // Handle camera permission request if needed
  if (hasPermission === false) {
    console.log(
      "[ScanScreen] Camera permission denied, showing permission screen",
    );
    return (
      <CameraPermission
        onPermissionGranted={handlePermissionGranted}
        onRetryPermission={handleRetryPermission}
      />
    );
  }

  // Loading state while checking permissions
  if (hasPermission === null) {
    console.log(
      "[ScanScreen] Camera permission checking, showing loading screen",
    );
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
                <ProcessingOverlay
                  isVisible={showProcessingOverlay}
                  stage={processingStage}
                  capturedImageUri={capturedImageUri}
                />

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
                <NoScansOverlay
                  isVisible={showNoScansOverlay && !showProcessingOverlay}
                  onDismiss={() => setShowNoScansOverlay(false)}
                  onUpgrade={() => {
                    // TODO: Implement upgrade flow
                    console.log("Upgrade to Pro");
                  }}
                />
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
            onCapture={onCapture}
            onImageSelected={onImageSelected}
            isCapturing={isScanCapturing || isProcessing}
            isReady={isCameraReady}
            flashMode={flashMode}
            onFlashToggle={toggleFlash}
            disabled={!isCameraReady || isProcessing || showProcessingOverlay}
          />

          {/* Simulation button for testing in development */}
          <SimulationButton
            isVisible={__DEV__ && !showProcessingOverlay}
            isMounted={isMounted}
            onSimulateCapture={simulateCapture}
          />
        </View>

        {/* Content Type Choice Modal */}
        <ContentTypeOverlay
          isVisible={showContentTypeOverlay}
          capturedImageUri={capturedImageUri}
          onSelectEvent={handleSelectEvent}
          onSelectCivicEngagement={handleSelectCivicEngagement}
          onCancel={handleCancelContentType}
        />
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
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-Regular",
    fontWeight: "600",
  },
});
