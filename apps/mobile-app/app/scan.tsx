// scan.tsx - Immersive full-width camera scan screen
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import Screen from "@/components/Layout/Screen";
import { useColors, spacing, fontSize, fontFamily, type Colors } from "@/theme";
import { useCamera } from "@/hooks/useCamera";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { CameraView } from "expo-camera";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Images } from "lucide-react-native";

// Import new modular components
import {
  ProcessingOverlay,
  NoScansOverlay,
  ScannerOverlay,
  SimulationButton,
  useScanState,
} from "@/components/Scan";

export default function ScanScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  // Auto-crop image to scanner overlay guide rails
  const BRACKET_INSET = 24;
  const scanTopOffset = insets.top + spacing.sm + 44 + spacing.md;
  const scanBottomOffset = 150;

  const processImageWithCrop = useCallback(
    async (uri: string) => {
      try {
        const { width: screenW, height: screenH } = Dimensions.get("window");

        // Scanner overlay region on screen
        const scanLeft = BRACKET_INSET;
        const scanRight = screenW - BRACKET_INSET;
        const scanTop = scanTopOffset;
        const scanBottom = screenH - scanBottomOffset;

        // Normalize to 0-1 ratios relative to screen
        const ratioX = scanLeft / screenW;
        const ratioY = scanTop / screenH;
        const ratioW = (scanRight - scanLeft) / screenW;
        const ratioH = (scanBottom - scanTop) / screenH;

        // Get actual image dimensions
        const { width: imgW, height: imgH } = await new Promise<{
          width: number;
          height: number;
        }>((resolve, reject) => {
          Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            reject,
          );
        });

        // CameraView uses cover mode — calculate visible portion of image
        const screenAspect = screenW / screenH;
        const imageAspect = imgW / imgH;

        let visibleOriginX = 0;
        let visibleOriginY = 0;
        let visibleW = imgW;
        let visibleH = imgH;

        if (imageAspect > screenAspect) {
          // Image wider than screen — horizontally cropped
          visibleW = imgH * screenAspect;
          visibleOriginX = (imgW - visibleW) / 2;
        } else {
          // Image taller than screen — vertically cropped
          visibleH = imgW / screenAspect;
          visibleOriginY = (imgH - visibleH) / 2;
        }

        // Map screen ratios to image pixel coordinates
        const originX = Math.round(visibleOriginX + ratioX * visibleW);
        const originY = Math.round(visibleOriginY + ratioY * visibleH);
        const cropW = Math.round(ratioW * visibleW);
        const cropH = Math.round(ratioH * visibleH);

        const cropped = await ImageManipulator.manipulateAsync(
          uri,
          [{ crop: { originX, originY, width: cropW, height: cropH } }],
          { format: ImageManipulator.SaveFormat.JPEG },
        );

        return processImage(cropped.uri);
      } catch (error) {
        console.error("[ScanScreen] Auto-crop failed, falling back:", error);
        return processImage(uri);
      }
    },
    [processImage, scanTopOffset],
  );

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
    processImage: processImageWithCrop,
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

  // Shutter flash for simulate capture
  const [showFlash, setShowFlash] = useState(false);

  const onSimulateCapture = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => {
      setShowFlash(false);
      simulateCapture();
    }, 150);
  }, [simulateCapture]);

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
          {/* Shutter flash overlay */}
          {showFlash && <View style={styles.flashOverlay} />}

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

      {/* Scanner overlay — corner brackets, scan line, motion detection */}
      <ScannerOverlay
        active={isCameraReady && !showProcessingOverlay && !showNoScansOverlay}
        topOffset={scanTopOffset}
        bottomOffset={scanBottomOffset}
      />

      {/* Camera not ready overlay */}
      {(!isCameraReady || !isCameraActive) && !showProcessingOverlay && (
        <View style={styles.cameraNotReadyOverlay}>
          <ActivityIndicator size="large" color={colors.fixed.white} />
          <Text style={styles.cameraNotReadyText}>Initializing camera...</Text>
        </View>
      )}

      {/* Floating back button (top-left) */}
      <Pressable
        style={[
          styles.floatingButton,
          { top: insets.top + spacing.sm, left: spacing.lg },
        ]}
        onPress={handleBack}
      >
        <ArrowLeft size={20} color={colors.fixed.white} />
      </Pressable>

      {/* Floating batch upload button (top-right) */}
      <Pressable
        style={[
          styles.floatingButton,
          { top: insets.top + spacing.sm, right: spacing.lg },
        ]}
        onPress={() => router.push("/batch-upload")}
      >
        <Images size={20} color={colors.fixed.white} />
      </Pressable>

      {/* Controls overlaid at bottom */}
      <View style={[styles.controlsOverlay, { paddingBottom: spacing.sm }]}>
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
          isVisible={__DEV__}
          isMounted={isMounted}
          onSimulateCapture={onSimulateCapture}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
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
  floatingButton: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.fixed.white,
    zIndex: 10,
  },
  controlsOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
