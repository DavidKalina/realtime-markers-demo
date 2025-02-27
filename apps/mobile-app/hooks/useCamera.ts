import { useRef, useState, useCallback, useEffect } from "react";
import { useCameraPermissions } from "expo-camera";
import { Alert, AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { manipulateImage } from "@/utils/imageUtils";

export const useCamera = () => {
  // Permissions - keep the original null state for loading
  const [permission, requestPermission] = useCameraPermissions();
  // Important: Use a true tri-state for permissions (null=loading, true=granted, false=denied)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Camera state
  const [isCapturing, setIsCapturing] = useState(false);
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // App state tracking
  const appState = useRef(AppState.currentState);
  const [appActive, setAppActive] = useState(true);

  // Debug state
  const [debugInfo, setDebugInfo] = useState({
    permissionChecks: 0,
    cameraReadyEvents: 0,
    lastOperation: "init",
    errors: [] as string[],
  });

  // Explicitly managed camera active state to avoid race conditions
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Add initialization timeout tracking
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Proper permission handling - maintain the tri-state
  useEffect(() => {
    const updatePermission = async () => {
      try {
        console.log("Checking camera permission status");
        setDebugInfo((prev) => ({
          ...prev,
          permissionChecks: prev.permissionChecks + 1,
          lastOperation: "checkingPermission",
        }));

        if (permission === null) {
          // Still loading, keep hasPermission as null
          return;
        }

        // Update hasPermission based on the permission state
        setHasPermission(permission.granted);

        // If permission is denied and can ask again, request it automatically
        if (!permission.granted && permission.canAskAgain) {
          console.log("Requesting camera permission");
          const result = await requestPermission();
          setHasPermission(result.granted);
        }
      } catch (error: any) {
        console.error("Error checking camera permission:", error);
        setDebugInfo((prev) => ({
          ...prev,
          errors: [...prev.errors, `Permission error: ${error.message || String(error)}`],
          lastOperation: "permissionError",
        }));
      }
    };

    updatePermission();
  }, [permission, requestPermission]);

  // Monitor app state for background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const isActive = nextAppState === "active";
      console.log("App state changed:", { nextAppState, wasActive: appActive, isActive });

      setAppActive(isActive);

      // If app comes back from background and camera should be active,
      // we'll need to wait for it to initialize again
      if (isActive && appState.current !== "active" && isFocused) {
        // Reset camera ready state when app comes from background
        setIsCameraReady(false);

        // Set a timeout to detect camera initialization issues
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
        }

        initTimeoutRef.current = setTimeout(() => {
          if (!isCameraReady) {
            console.warn("Camera failed to initialize within timeout period");
            setDebugInfo((prev) => ({
              ...prev,
              errors: [...prev.errors, "Camera initialization timeout"],
              lastOperation: "initTimeout",
            }));
          }
        }, 8000); // 8 second timeout
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [isFocused, appActive, isCameraReady]);

  // Handle camera readiness
  const onCameraReady = useCallback(() => {
    console.log("Camera ready event fired");
    setIsCameraReady(true);
    setDebugInfo((prev) => ({
      ...prev,
      cameraReadyEvents: prev.cameraReadyEvents + 1,
      lastOperation: "cameraReady",
    }));

    // Clear initialization timeout if it exists
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const shouldBeActive = isFocused && appActive && hasPermission === true;
    console.log("Camera active state calculation:", {
      isFocused,
      appActive,
      hasPermission,
      shouldBeActive,
      currentlyActive: isCameraActive,
      isCameraReady,
    });

    if (shouldBeActive !== isCameraActive) {
      console.log(`Setting camera active: ${shouldBeActive}`);
      setIsCameraActive(shouldBeActive);
    }

    // Fix: Only start timer when camera should be active and has permission, but isn't ready yet
    if (shouldBeActive && hasPermission === true && !isCameraReady) {
      console.log("Starting camera ready safety timer");
      // Set a safety timer to ensure camera ready state is set
      const readyTimer = setTimeout(() => {
        if (!isCameraReady) {
          console.log("Camera ready state forced after timeout");
          setIsCameraReady(true);
        }
      }, 3000);

      return () => clearTimeout(readyTimer);
    }
  }, [isFocused, appActive, hasPermission, isCameraActive, isCameraReady]);
  // Reset camera state when screen loses focus or app goes to background
  useEffect(() => {
    if (!isFocused || !appActive) {
      setIsCameraReady(false);
      setIsCapturing(false);
    }
  }, [isFocused, appActive]);

  // Explicit function to release camera resources
  const releaseCamera = useCallback(() => {
    console.log("Releasing camera resources");

    // Reset all camera states
    setIsCameraReady(false);
    setIsCapturing(false);

    // Clear any pending timeouts
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }

    setDebugInfo((prev) => ({
      ...prev,
      lastOperation: "releaseCamera",
    }));
  }, []);

  // Make sure we clean up when component unmounts
  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  // Take picture with improved error handling
  const takePicture = async () => {
    // Defensive check for all required states
    if (!cameraRef.current || isCapturing || !isCameraReady || !isCameraActive) {
      console.log("Cannot take picture:", {
        hasRef: !!cameraRef.current,
        isCapturing,
        isCameraReady,
        isCameraActive,
      });
      return null;
    }

    try {
      setIsCapturing(true);
      setDebugInfo((prev) => ({
        ...prev,
        lastOperation: "takingPicture",
      }));

      const photo = await (cameraRef.current as any).takePictureAsync({
        quality: 0.7,
      });

      const processedImage = await manipulateImage(photo.uri);

      setDebugInfo((prev) => ({
        ...prev,
        lastOperation: "pictureSuccess",
      }));

      return processedImage.uri;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to capture image";
      console.error("Error capturing image:", error);

      setDebugInfo((prev) => ({
        ...prev,
        errors: [...prev.errors, `Picture error: ${errorMsg}`],
        lastOperation: "pictureError",
      }));

      Alert.alert("Error", `${errorMsg}. Please try again.`, [{ text: "OK" }], {
        cancelable: false,
      });

      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  // Force permission check function
  const checkPermission = useCallback(async () => {
    try {
      console.log("Manually checking permission");
      const result = await requestPermission();
      setHasPermission(result.granted);
      return result.granted;
    } catch (error) {
      console.error("Error in manual permission check:", error);
      return false;
    }
  }, [requestPermission]);

  // Get debug state for troubleshooting
  const getDebugInfo = useCallback(() => {
    return {
      ...debugInfo,
      states: {
        hasPermission,
        isCameraActive,
        isCameraReady,
        isCapturing,
        appActive,
        isFocused,
      },
    };
  }, [debugInfo, hasPermission, isCameraActive, isCameraReady, isCapturing, appActive, isFocused]);

  return {
    cameraRef,
    takePicture,
    isCapturing,
    hasPermission,
    requestPermission,
    checkPermission,
    isPermissionLoading: hasPermission === null,
    isCameraActive,
    isCameraReady,
    onCameraReady,
    releaseCamera,
    getDebugInfo,
  };
};
