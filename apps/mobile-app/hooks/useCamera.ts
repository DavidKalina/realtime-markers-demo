import { useRef, useState } from "react";
import { useCameraPermissions } from "expo-camera";
import { Alert } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { manipulateImage } from "@/utils/imageUtils";

export const useCamera = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);

  const hasPermission = permission?.granted ?? false;
  const isPermissionLoading = permission === null;

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return null;

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
  };
};
