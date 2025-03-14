// useCamera.ts - Updated for non-blocking processing
import { useRef, useState, useCallback, useEffect } from "react";
import { useCameraPermissions, FlashMode } from "expo-camera";
import { Alert, AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { manipulateImage } from "@/utils/imageUtils";

export const useCamera = () => {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

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

  // Permission handling
  useEffect(() => {
    const updatePermission = async () => {
      try {
        if (permission === null) return;

        setHasPermission(permission.granted);

        if (!permission.granted && permission.canAskAgain) {
          const result = await requestPermission();
          setHasPermission(result.granted);
        }
      } catch (error: any) {
        console.error("Error checking camera permission:", error);
      }
    };

    updatePermission();
  }, [permission, requestPermission]);

  // Monitor app state for background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const isActive = nextAppState === "active";
      setAppActive(isActive);

      if (isActive && appState.current !== "active" && isFocused) {
        setIsCameraReady(false);
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isFocused]);

  // Handle camera readiness - simpler version with logging
  const onCameraReady = useCallback(() => {
    console.log("Camera is now ready");
    setIsCameraReady(true);
  }, []);

  // Update camera active state based on all required conditions
  useEffect(() => {
    const shouldBeActive = isFocused && appActive && hasPermission === true;
    if (shouldBeActive !== isCameraActive) {
      console.log(`Camera active state changing to: ${shouldBeActive}`);
      setIsCameraActive(shouldBeActive);

      // Reset camera ready state when becoming active
      if (shouldBeActive) {
        setIsCameraReady(false);
      }
    }
  }, [isFocused, appActive, hasPermission, isCameraActive]);

  // Reset camera state when screen loses focus or app goes to background
  useEffect(() => {
    if (!isFocused || !appActive) {
      console.log("Screen lost focus or app went to background, resetting camera states");
      setIsCameraReady(false);
      setIsCapturing(false);
    }
  }, [isFocused, appActive]);

  // Release camera resources
  const releaseCamera = useCallback(() => {
    setIsCameraReady(false);
    setIsCapturing(false);
    setCapturedImage(null);
  }, []);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  // Take picture - simplified version with flash support
  // Modified to only return URI without storing in state to support background processing
  const takePicture = async () => {
    if (!cameraRef.current || isCapturing || !isCameraReady || !isCameraActive) {
      return null;
    }

    try {
      setIsCapturing(true);

      const photo = await (cameraRef.current as any).takePictureAsync({
        quality: 0.8,
      });

      // Return the URI directly without setting to state
      // This allows for non-blocking processing
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
      switch (prevMode) {
        case "off":
          return "on";
        case "on":
          return "auto";
        case "auto":
        default:
          return "off";
      }
    });
  }, []);

  // Process the captured image - separate from taking the picture
  const processImage = async (uri: string) => {
    try {
      const processedImage = await manipulateImage(uri);
      return processedImage.uri;
    } catch (error) {
      console.error("Error processing image:", error);
      return null;
    }
  };

  // Discard captured image and return to camera
  const discardImage = useCallback(() => {
    setCapturedImage(null);
  }, []);

  // Check permission function
  const checkPermission = useCallback(async () => {
    try {
      const result = await requestPermission();
      setHasPermission(result.granted);
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
  };
};
