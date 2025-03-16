// useCamera.ts - Improved version with better error handling and lifecycle management
import { useRef, useState, useCallback, useEffect } from "react";
import { useCameraPermissions, FlashMode } from "expo-camera";
import { Alert, AppState, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

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

  // Permission handling - improved with better state tracking
  useEffect(() => {
    const updatePermission = async () => {
      try {
        if (permission === null) return;

        // Update permission state
        setHasPermission(permission.granted);

        // If we don't have permission yet and haven't requested it, request it
        if (!permission.granted && permission.canAskAgain && !permissionRequested) {
          setPermissionRequested(true);
          const result = await requestPermission();
          setHasPermission(result.granted);

          // If we still don't have permission, show a more helpful message
          if (!result.granted) {
            Alert.alert(
              "Camera Access Required",
              "This feature requires camera access. Please enable camera permissions in your device settings.",
              [{ text: "OK" }]
            );
          }
        }
      } catch (error: any) {
        console.error("Error checking camera permission:", error);
      }
    };

    updatePermission();
  }, [permission, requestPermission, permissionRequested]);

  // Monitor app state for background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const isActive = nextAppState === "active";
      setAppActive(isActive);

      if (isActive && appState.current !== "active" && isFocused) {
        setIsCameraReady(false);

        // Small delay before re-initializing camera
        setTimeout(() => {
          if (cameraRef.current) {
            setIsCameraActive(true);
          }
        }, 300);
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isFocused]);

  // Handle camera readiness with better logging
  const onCameraReady = useCallback(() => {
    setIsCameraReady(true);
    cameraInitialized.current = true;
  }, []);

  // Update camera active state based on all required conditions
  useEffect(() => {
    const shouldBeActive = isFocused && appActive && hasPermission === true;

    if (shouldBeActive !== isCameraActive) {
      setIsCameraActive(shouldBeActive);

      // Reset camera ready state when becoming active
      if (shouldBeActive) {
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

  // Release camera resources
  const releaseCamera = useCallback(() => {
    setIsCameraReady(false);
    setIsCapturing(false);
    setCapturedImage(null);
    cameraInitialized.current = false;
  }, []);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  // Take picture - robust version with better error handling and flash support
  const takePicture = async () => {
    if (!cameraRef.current) {
      return null;
    }

    if (isCapturing) {
      return null;
    }

    if (!isCameraReady) {
      return null;
    }

    if (!isCameraActive) {
      return null;
    }

    try {
      setIsCapturing(true);

      const photo = await (cameraRef.current as any).takePictureAsync({
        quality: 0.8,
        exif: true,
        flashMode: flashMode,
      });

      // Return the URI directly
      return photo.uri;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to capture image";
      console.error("Error capturing image:", error);

      Alert.alert("Error", `${errorMsg}. Please try again.`, [{ text: "OK" }], {
        cancelable: false,
      });

      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  // Toggle flash mode function
  const toggleFlash = useCallback(() => {
    setFlashMode((prevMode) => {
      const newMode = prevMode === "off" ? "on" : "off";
      return newMode;
    });
  }, []);

  // For useCamera.ts - Updated processImage function with proper type checking
  const processImage = async (uri: string) => {
    try {
      // Get file info with proper type checking
      const fileInfo = await FileSystem.getInfoAsync(uri);

      // Use Image Manipulator for consistent processing
      const processed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Resize to max width of 1200px
        { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG } // 30% quality JPEG
      );

      // Log processed size with proper type checking
      const processedInfo = await FileSystem.getInfoAsync(processed.uri);

      return processed.uri;
    } catch (error) {
      console.error("Error processing image:", error);
      return uri; // Fall back to original if processing fails
    }
  };

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
        }, 500);
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
