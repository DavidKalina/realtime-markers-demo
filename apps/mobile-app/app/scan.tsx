// scan.tsx - Updated version with document scanner
import { CameraControls } from "@/components/CameraControls";
import { CameraPermission } from "@/components/CameraPermissions/CameraPermission";
import { useUserLocation } from "@/contexts/LocationContext";
import { useCamera } from "@/hooks/useCamera";
import { useEventBroker } from "@/hooks/useEventBroker";
import apiClient from "@/services/ApiClient";
import { EventTypes } from "@/services/EventBroker";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

type ImageSource = "camera" | "gallery" | null;

export default function ScanScreen() {
  const {
    hasPermission,
    takePicture,
    processImage,
    isCapturing,
    permissionRequested,
    checkPermission,
  } = useCamera();

  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<ImageSource>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const isMounted = useRef(true);

  const { userLocation } = useUserLocation();
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addJob = useJobSessionStore((state) => state.addJob);
  const { publish } = useEventBroker();

  // Start scanning immediately when the screen mounts
  useEffect(() => {
    if (hasPermission) {
      handleScan();
    }
  }, [hasPermission]);

  // Set mounted flag to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  // Queue job and navigate after a brief delay
  const queueJobAndNavigateDelayed = useCallback(
    (jobId: string) => {
      if (!jobId || !isMounted.current) return;

      // Add to job queue
      addJob(jobId);

      // Publish job queued event
      publish(EventTypes.JOB_QUEUED, {
        timestamp: Date.now(),
        source: "ScanScreen",
        jobId: jobId,
        message: "Document scan queued for processing",
      });

      // Set a timer to navigate away after a brief preview
      navigationTimerRef.current = setTimeout(() => {
        if (isMounted.current) {
          // Navigate back to the map
          router.replace("/");
        }
      }, 1500); // Show preview for 1.5 seconds
    },
    [addJob, publish, router]
  );

  // Updated uploadImageAndQueue function to handle both camera and gallery sources
  const uploadImageAndQueue = async (uri: string) => {
    if (!isMounted.current) return null;

    try {
      setUploadProgress(10);

      // For base64 images from document scanner, we need to format it correctly
      const imageUri = uri.startsWith('data:') ? uri : `data:image/jpeg;base64,${uri}`;

      // Create imageFile object for apiClient
      const imageFile = {
        uri: imageUri,
        name: "document.jpg",
        type: "image/jpeg",
      } as any;

      // Add location data if available
      if (userLocation) {
        imageFile.userLat = userLocation[1].toString();
        imageFile.userLng = userLocation[0].toString();
      }

      setUploadProgress(70);

      // Upload using API client
      const result = await apiClient.processEventImage(imageFile);

      setUploadProgress(100);

      if (result.jobId && isMounted.current) {
        addJob(result.jobId);
        router.replace("/");
        return result.jobId;
      }
    } catch (error) {
      console.error("Upload failed:", error);
      if (isMounted.current) {
        Alert.alert(
          "Upload Failed",
          "Failed to process the document. Please try again.",
          [{ text: "OK" }]
        );
      }
      throw error;
    }
  };

  const handleScan = async () => {
    if (!isMounted.current) return;

    try {
      setIsUploading(true);

      const photoUri = await takePicture();
      if (!photoUri) {
        throw new Error("No image captured");
      }

      // Navigate back to map
      router.replace("/");

    } catch (error) {
      console.error("Scan failed:", error);
      if (isMounted.current) {
        Alert.alert(
          "Scanner Error",
          "Failed to process the document. Please try again.",
          [{
            text: "Try Again",
            onPress: handleScan
          }, {
            text: "Cancel",
            onPress: () => router.replace("/"),
            style: "cancel"
          }]
        );
      }
    } finally {
      if (isMounted.current) {
        setIsUploading(false);
      }
    }
  };

  // Handle image capture - using document scanner
  const handleCapture = async () => {
    if (!isMounted.current) return;

    try {
      setIsUploading(true);
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Opening document scanner...",
      });

      const photoUri = await takePicture();
      if (!photoUri) {
        throw new Error("No image captured");
      }

      if (isMounted.current) {
        setCapturedImage(photoUri);
        setImageSource("camera");
        await uploadImageAndQueue(photoUri);
      }
    } catch (error) {
      console.error("Capture failed:", error);
      if (isMounted.current) {
        Alert.alert(
          "Scanner Error",
          "Failed to open the document scanner. Please try again.",
          [{ text: "OK" }]
        );
      }
    } finally {
      if (isMounted.current) {
        setIsUploading(false);
      }
    }
  };

  // Handle image selection from gallery
  const handleImageSelected = async (uri: string) => {
    if (!isMounted.current) return;

    try {
      // Show the selected image
      setCapturedImage(uri);
      setImageSource("gallery");

      // Start upload process
      setIsUploading(true);

      // Show a notification
      publish(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "ScanScreen",
        message: "Processing document from gallery...",
      });

      // Upload the image and process
      await uploadImageAndQueue(uri);
    } catch (error) {
      console.error("Gallery image processing failed:", error);

      if (isMounted.current) {
        Alert.alert("Operation Failed", "Failed to process the selected image. Please try again.", [
          { text: "OK" },
        ]);

        setCapturedImage(null);
        setImageSource(null);
        setIsUploading(false);
      }
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    if (!isMounted.current) return;

    setCapturedImage(null);
    setImageSource(null);
    setIsUploading(false);

    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  };

  // Back button handler
  const handleBack = () => {
    if (!isMounted.current) return;

    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
    }

    setTimeout(() => {
      if (isMounted.current) {
        router.replace("/");
      }
    }, 50);
  };

  // Handle permission request if needed
  if (hasPermission === false) {
    return (
      <CameraPermission
        onPermissionGranted={() => {
          // Start scanning immediately after permission is granted
          handleScan();
        }}
        onRetryPermission={checkPermission}
      />
    );
  }

  // Loading state while checking permissions
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loaderText}>Checking camera permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Simple loading screen while scanner is active
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#93c5fd" />
        <Text style={styles.loaderText}>Opening document scanner...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    color: "#f8f9fa",
    marginTop: 16,
    fontFamily: "SpaceMono",
  }
});
