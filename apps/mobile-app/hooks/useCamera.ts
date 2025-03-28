// useCamera.ts - Improved version with better error handling and lifecycle management
import { DocumentDetectionService } from "@/services/DocumentDetectionService";
import { useIsFocused } from "@react-navigation/native";
import { CameraViewRef, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

export const useCamera = () => {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Camera state
  const [isCapturing, setIsCapturing] = useState(false);
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraViewRef>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState<"on" | "off">("off");

  // App state tracking
  const appState = useRef(AppState.currentState);
  const [appActive, setAppActive] = useState(true);

  // Explicitly managed camera active state
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Track camera initialization
  const cameraInitialized = useRef(false);

  // Document detection
  const detectionService = useRef(DocumentDetectionService.getInstance());
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const [detectionResult, setDetectionResult] = useState<{
    isDetected: boolean;
    confidence: number;
    corners?: [[number, number], [number, number], [number, number], [number, number]];
  } | null>(null);

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
    setIsCameraActive(true);
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
    setIsCameraActive(false);
    stopDocumentDetection();
  }, []);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  // Initialize document detection service
  useEffect(() => {
    const initDetection = async () => {
      try {
        await detectionService.current.initialize();
      } catch (error) {
        console.error("Failed to initialize document detection:", error);
      }
    };

    initDetection();

    return () => {
      isMounted.current = false;
      detectionService.current.cleanup();
    };
  }, []);

  // Update frame capture
  const startDocumentDetection = useCallback(() => {
    if (!cameraRef.current || !isCameraReady || !isCameraActive) return;

    // Clear any existing interval
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }

    // Start new detection interval
    frameIntervalRef.current = setInterval(async () => {
      if (!isMounted.current || !cameraRef.current || !isCameraReady || !isCameraActive) {
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
        }
        return;
      }

      try {
        // Get current frame using the correct method
        const frame = await cameraRef.current.takePicture({
          quality: 1,
          base64: true,
          exif: true,
          skipProcessing: true,
        });
        if (!frame) return;

        // Run document detection with the frame URI
        const result = await detectionService.current.detectDocument({ uri: frame.uri });
        
        if (isMounted.current) {
          setDetectionResult(result);
        }
      } catch (error) {
        console.error("Error in document detection:", error);
      }
    }, 500); // Run detection every 500ms
  }, [isCameraReady, isCameraActive]);

  // Stop document detection
  const stopDocumentDetection = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  // Start/stop detection based on camera state
  useEffect(() => {
    if (isCameraReady && isCameraActive) {
      startDocumentDetection();
    } else {
      stopDocumentDetection();
    }

    return stopDocumentDetection;
  }, [isCameraReady, isCameraActive, startDocumentDetection, stopDocumentDetection]);

  // Take picture - robust version with better error handling and flash support
  const takePicture = async (): Promise<string | null> => {
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

      const photo = await cameraRef.current.takePicture({
        quality: 1,
        base64: true,
        exif: true,
        skipProcessing: true,
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
  const processImage = async (uri: string): Promise<string | null> => {
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
  const checkPermission = useCallback(async (): Promise<boolean> => {
    try {
      setPermissionRequested(true);
      const result = await requestPermission();
      const granted = result.granted;
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error("Error checking camera permission:", error);
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
    detectionResult,
  };
};
