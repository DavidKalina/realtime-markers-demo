// scan.tsx - Immersive full-width camera scan screen
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import Screen from "@/components/Layout/Screen";
import { colors, spacing, fontSize, fontFamily } from "@/theme";
import { useCamera } from "@/hooks/useCamera";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { CameraView } from "expo-camera";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

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
  const insets = useSafeAreaInsets();

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

  // Back button handler
  const handleBack = useCallback(() => {
    if (!isMounted.current) return;
    reset();
    router.replace("/");
  }, [reset, router]);

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
        onPermissionGranted={() => {}}
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
    <View style={styles.container}>
      {/* Camera fills entire screen */}
      {isCameraActive ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          onCameraReady={onCameraReady}
          flash={flashMode}
        >
          {/* Processing Overlay */}
          <ProcessingOverlay
            isVisible={showProcessingOverlay}
            stage={processingStage}
            capturedImageUri={capturedImageUri}
          />

          {/* No Scans Available Overlay */}
          <NoScansOverlay
            isVisible={showNoScansOverlay && !showProcessingOverlay}
            onDismiss={() => setShowNoScansOverlay(false)}
          />
        </CameraView>
      ) : null}

      {/* Camera not ready overlay */}
      {(!isCameraReady || !isCameraActive) && !showProcessingOverlay && (
        <View style={styles.cameraNotReadyOverlay}>
          <ActivityIndicator size="large" color={colors.fixed.white} />
          <Text style={styles.cameraNotReadyText}>Initializing camera...</Text>
        </View>
      )}

      {/* Floating back button */}
      <Pressable
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
        onPress={handleBack}
      >
        <ArrowLeft size={20} color={colors.fixed.white} />
      </Pressable>

      {/* Controls overlaid at bottom */}
      <View
        style={[
          styles.controlsOverlay,
          { paddingBottom: insets.bottom + spacing.sm },
        ]}
      >
        <CameraControls
          onCapture={onCapture}
          onImageSelected={onImageSelected}
          isCapturing={isScanCapturing || isProcessing}
          isReady={isCameraReady}
          flashMode={flashMode}
          onFlashToggle={toggleFlash}
          disabled={!isCameraReady || isProcessing || showProcessingOverlay}
        />

        {/* Batch upload link */}
        <Pressable
          style={styles.batchUploadLink}
          onPress={() => router.push("/batch-upload")}
        >
          <Text style={styles.batchUploadText}>Upload multiple photos</Text>
        </Pressable>

        {/* Simulation button for testing in development */}
        <SimulationButton
          isVisible={__DEV__ && !showProcessingOverlay}
          isMounted={isMounted}
          onSimulateCapture={simulateCapture}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fixed.black,
  },
  cameraNotReadyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.fixed.black,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraNotReadyText: {
    color: colors.fixed.white,
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
  backButton: {
    position: "absolute",
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlsOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  batchUploadLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  batchUploadText: {
    color: colors.fixed.white,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
  },
});
