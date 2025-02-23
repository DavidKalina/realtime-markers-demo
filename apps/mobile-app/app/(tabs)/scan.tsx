import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const API_URL = "https://577e-69-162-231-94.ngrok-free.app/api/events/process"; // Replace with your actual server URL

const uploadImageToServer = async (imageUri: string): Promise<any> => {
  try {
    // Create form data
    const formData = new FormData();

    // Add the image file to form data
    formData.append("image", {
      uri: imageUri,
      type: "image/jpeg", // or 'image/png'
      name: "upload.jpg",
    } as any);

    // Make the API call
    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to process image");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

const ScanScreen: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const { push } = useRouter();

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);

      // Take the picture
      const photo = await (cameraRef.current as any).takePictureAsync({
        quality: 0.7,
      });

      // Process the image
      const processedImage = await manipulateAsync(photo.uri, [{ resize: { width: 1200 } }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });

      // Start processing state
      setIsCapturing(false);
      setIsProcessing(true);

      // Upload to server
      const result = await uploadImageToServer(processedImage.uri);

      // Show success message
      Alert.alert(
        "Success",
        "Event processed successfully!",
        [{ text: "OK", onPress: () => setIsProcessing(false) }],
        { cancelable: false }
      );

      push(`/`);

      // Here you might want to navigate to an event details screen
      // navigation.navigate('EventDetails', { event: result });
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to process image. Please try again.",
        [
          {
            text: "OK",
            onPress: () => {
              setIsCapturing(false);
              setIsProcessing(false);
            },
          },
        ],
        { cancelable: false }
      );
      console.error("Error capturing image:", error);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera access is required to scan documents</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isFocused) {
    return null;
  }

  if (isProcessing) {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.processingText}>Processing image...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera}>
        <View style={styles.overlay}>
          {/* Simple capture frame */}
          <View style={styles.scanFrame} />
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  message: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: "80%",
    height: "50%",
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 10,
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonDisabled: {
    opacity: 0.7,
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
  },
  processingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#000",
  },
});

export default ScanScreen;
