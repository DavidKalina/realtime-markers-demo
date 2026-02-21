// scan.tsx - Refactored to use modular components
import { AuthWrapper } from "@/components/AuthWrapper";
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import Screen from "@/components/Layout/Screen";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";
import { useCamera } from "@/hooks/useCamera";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { CameraView } from "expo-camera";
import { usePathname, useRouter } from "expo-router";
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
  SimulationButton,
  useScanState,
} from "@/components/Scan";

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

    // Scan limits
    showNoScansOverlay,
    setShowNoScansOverlay,

    // Actions
    handleCapture,
    handleImageSelected,
    handleSelectEvent,
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

  const pathname = usePathname();

  // Check permission when the scan screen gains focus
  useEffect(() => {
    if (pathname === "/scan") {
      checkPermission();
    }
    return () => {
      if (pathname !== "/scan") {
        console.log("[ScanScreen] Screen unfocused");
      }
    };
  }, [pathname, checkPermission]);
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

  // Auto-process as event when image is captured (scan is event-only)
  useEffect(() => {
    if (capturedImageUri && !isProcessing && !showProcessingOverlay) {
      handleSelectEvent();
    }
  }, [capturedImageUri]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <ActivityIndicator size="large" color={colors.accent.primary} />
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
                    <ActivityIndicator
                      size="large"
                      color={colors.fixed.white}
                    />
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
                <ActivityIndicator size="large" color={colors.accent.primary} />
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
      </Screen>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    padding: spacing.sm,
    minHeight: 400,
  },
  cameraCard: {
    flex: 1,
    borderRadius: radius["2xl"],
    overflow: "hidden",
    backgroundColor: colors.bg.card,
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderColor: colors.border.default,
  },
  camera: {
    flex: 1,
  },
  cameraNotReadyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraNotReadyText: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: colors.bg.card,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius["2xl"],
  },
  cameraPlaceholderText: {
    color: colors.text.secondary,
    marginTop: spacing.lg,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    color: colors.text.secondary,
    marginTop: spacing.lg,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
  },
  controlsContainer: {
    paddingBottom: spacing.lg,
    position: "relative",
  },
  scanCountBadge: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.lg,
    backgroundColor: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing._6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  scanCountText: {
    color: colors.bg.card,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },
});
