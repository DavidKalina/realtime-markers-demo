import { useRef, useState, useCallback, useEffect } from "react";
import { useCameraPermissions } from "expo-camera";
import { Alert } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { manipulateImage } from "@/utils/imageUtils";

export const useCamera = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const hasPermission = permission?.granted ?? false;
  const isPermissionLoading = permission === null;

  // Handle camera readiness
  const onCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  // Reset camera state when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      setIsCameraReady(false);
      setIsCapturing(false);
    }
  }, [isFocused]);

  // Explicit function to release camera resources
  const releaseCamera = useCallback(() => {
    if (cameraRef.current) {
      // Reset camera state
      setIsCameraReady(false);
      setIsCapturing(false);

      // In expo-camera, there's no explicit release method,
      // but we can help the GC by nullifying references
      // when component unmounts
    }
  }, []);

  // Make sure we clean up when component unmounts
  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing || !isCameraReady) return null;

    try {
      setIsCapturing(true);
      const photo = await (cameraRef.current as any).takePictureAsync({
        quality: 0.7,
      });

      const processedImage = await manipulateImage(photo.uri);
      return processedImage.uri;
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to capture image. Please try again.",
        [{ text: "OK" }],
        { cancelable: false }
      );
      console.error("Error capturing image:", error);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  return {
    cameraRef,
    takePicture,
    isCapturing,
    hasPermission,
    requestPermission,
    isPermissionLoading,
    isCameraActive: isFocused,
    isCameraReady,
    onCameraReady,
    releaseCamera,
  };
};
