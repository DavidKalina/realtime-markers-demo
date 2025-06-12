// useCamera.ts - Improved version with better error handling and lifecycle management
import { useIsFocused } from "@react-navigation/native";
import { FlashMode, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

// Constants for camera configuration
const CAMERA_CONFIG = {
  PHOTO_QUALITY: 0.8,
  PROCESSED_WIDTH: 1200,
  PROCESSED_QUALITY: 0.3,
  CAMERA_REINIT_DELAY: 300,
  PERMISSION_DELAY: 500,
} as const;

export const useCamera = () => {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Camera state
  const [isCapturing, setIsCapturing] = useState(false);
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState<FlashMode>("off");

  // App state tracking
  const appState = useRef(AppState.currentState);
  const [appActive, setAppActive] = useState(true);

  // Explicitly managed camera active state
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Track camera initialization
  const cameraInitialized = useRef(false);

  // Memoize camera configuration
  const cameraConfig = useMemo(
    () => ({
      quality: CAMERA_CONFIG.PHOTO_QUALITY,
      exif: true,
      flashMode,
    }),
    [flashMode],
  );

  // Release camera resources
  const releaseCamera = useCallback(() => {
    // Reset all camera states
    setIsCameraReady(false);
    setIsCapturing(false);
    setCapturedImage(null);
    setIsCameraActive(false);
    cameraInitialized.current = false;

    // Clear camera ref
    if (cameraRef.current) {
      cameraRef.current = null;
    }

    // Reset flash mode
    setFlashMode("off");

    // Reset permission states
    setHasPermission(null);
    setPermissionRequested(false);
  }, []);

  // Permission handling - improved with better state tracking
  useEffect(() => {
    const updatePermission = async () => {
      try {
        console.log("[Camera] Updating permission:", permission);
        if (permission === null) return;

        // Update permission state
        setHasPermission(permission.granted);

        // If we don't have permission yet and haven't requested it, request it
        if (
          !permission.granted &&
          permission.canAskAgain &&
          !permissionRequested
        ) {
          setPermissionRequested(true);
          const result = await requestPermission();
          setHasPermission(result.granted);

          // If we still don't have permission, show a more helpful message
          if (!result.granted) {
            Alert.alert(
              "Camera Access Required",
              "This feature requires camera access. Please enable camera permissions in your device settings.",
              [{ text: "OK" }],
            );
          }
        }
      } catch (error) {
        console.error("Error checking camera permission:", error);
      }
    };

    updatePermission();
  }, [permission, requestPermission, permissionRequested]);

  // Monitor app state for background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        const isActive = nextAppState === "active";
        setAppActive(isActive);

        console.log("[Camera] App state changed:", nextAppState);

        if (isActive && appState.current !== "active" && isFocused) {
          // When app comes back to foreground, refresh permission state
          if (permission) {
            setHasPermission(permission.granted);
          }

          setIsCameraReady(false);

          // Small delay before re-initializing camera
          setTimeout(() => {
            if (cameraRef.current) {
              setIsCameraActive(true);
            }
          }, CAMERA_CONFIG.CAMERA_REINIT_DELAY);
        } else if (!isActive) {
          // Clean up when app goes to background
          releaseCamera();
        }

        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
      releaseCamera();
    };
  }, [isFocused, releaseCamera, permission]);

  // Handle camera readiness with better logging
  const onCameraReady = useCallback(() => {
    console.log("[Camera] Camera ready callback triggered");
    setIsCameraReady(true);
    cameraInitialized.current = true;
  }, []);

  // Update camera active state based on all required conditions
  useEffect(() => {
    const shouldBeActive = isFocused && appActive && hasPermission === true;
    console.log("[Camera] Camera state conditions:", {
      isFocused,
      appActive,
      hasPermission,
      shouldBeActive,
      currentlyActive: isCameraActive,
    });

    if (shouldBeActive !== isCameraActive) {
      setIsCameraActive(shouldBeActive);

      // Reset camera ready state when becoming active, with a small delay
      if (shouldBeActive) {
        const timeoutId = setTimeout(() => {
          if (!cameraInitialized.current) {
            setIsCameraReady(false);
            cameraInitialized.current = false;
          }
        }, 100);

        return () => clearTimeout(timeoutId);
      } else {
        setIsCameraReady(false);
        cameraInitialized.current = false;
      }
    }
  }, [isFocused, appActive, hasPermission, isCameraActive]);

  // Reset camera state when screen loses focus or app goes to background
  useEffect(() => {
    if (!isFocused || !appActive) {
      setIsCameraReady(false);
      setIsCapturing(false);
    }
  }, [isFocused, appActive]);

  // Take picture - robust version with better error handling and flash support
  const takePicture = useCallback(async () => {
    console.log("[Camera] Taking picture:", {
      hasRef: !!cameraRef.current,
      isCapturing,
      isCameraReady,
      isCameraActive,
    });

    if (
      !cameraRef.current ||
      isCapturing ||
      !isCameraReady ||
      !isCameraActive
    ) {
      console.log("[Camera] Cannot take picture:", {
        noRef: !cameraRef.current,
        isCapturing,
        notReady: !isCameraReady,
        notActive: !isCameraActive,
      });
      return null;
    }

    try {
      console.log("[Camera] Starting capture...");
      setIsCapturing(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const photo = await (cameraRef.current as any).takePictureAsync(
        cameraConfig,
      );
      console.log("[Camera] Picture taken successfully");

      // Return the URI directly
      return photo.uri;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to capture image";
      console.error("[Camera] Error capturing image:", error);

      Alert.alert("Error", `${errorMsg}. Please try again.`, [{ text: "OK" }], {
        cancelable: false,
      });

      return null;
    } finally {
      console.log("[Camera] Capture complete");
      setIsCapturing(false);
    }
  }, [cameraRef, isCapturing, isCameraReady, isCameraActive, cameraConfig]);

  // Toggle flash mode function
  const toggleFlash = useCallback(() => {
    setFlashMode((prevMode) => (prevMode === "off" ? "on" : "off"));
  }, []);

  // Memoize image processing configuration
  const processImageConfig = useMemo(
    () => ({
      resize: {
        width: CAMERA_CONFIG.PROCESSED_WIDTH,
      } as unknown as ImageManipulator.Action,
      compress: CAMERA_CONFIG.PROCESSED_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }),
    [],
  );

  // For useCamera.ts - Updated processImage function with proper type checking
  const processImage = useCallback(
    async (uri: string) => {
      try {
        // Get file info with proper type checking
        await FileSystem.getInfoAsync(uri);

        // Use Image Manipulator for consistent processing
        const processed = await ImageManipulator.manipulateAsync(
          uri,
          [
            {
              resize: { width: CAMERA_CONFIG.PROCESSED_WIDTH },
            } as unknown as ImageManipulator.Action,
          ],
          {
            compress: processImageConfig.compress,
            format: processImageConfig.format,
          },
        );

        return processed.uri;
      } catch (error) {
        console.error("Error processing image:", error);
        return uri; // Fall back to original if processing fails
      }
    },
    [processImageConfig],
  );

  // Discard captured image and return to camera
  const discardImage = useCallback(() => {
    setCapturedImage(null);
  }, []);

  // Explicitly request camera permission - useful for manual retry
  const checkPermission = useCallback(async () => {
    try {
      const result = await requestPermission();
      setHasPermission(result.granted);

      if (result.granted) {
        // Small delay to let the system register the permission
        setTimeout(() => {
          setIsCameraActive(true);
        }, CAMERA_CONFIG.PERMISSION_DELAY);
      }

      return result.granted;
    } catch (error) {
      console.error("Error in manual permission check:", error);
      return false;
    }
  }, [requestPermission]);

  return {
    cameraRef,
    takePicture,
    processImage,
    isCapturing,
    hasPermission,
    requestPermission,
    checkPermission,
    isPermissionLoading: hasPermission === null,
    isCameraActive,
    isCameraReady,
    onCameraReady,
    releaseCamera,
    capturedImage,
    discardImage,
    flashMode,
    toggleFlash,
    // Additional state that can be helpful for debugging
    permissionRequested,
  };
};
