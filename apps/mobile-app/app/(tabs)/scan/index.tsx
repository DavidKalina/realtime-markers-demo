import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraPermission } from "@/components/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton";
import { SuccessScreen } from "@/components/SuccessScreen";
import { ScannerOverlay } from "@/components/ScannerOverlay";
import { useCamera } from "@/hooks/useCamera";
import { useImageUpload } from "@/hooks/useImageUpload";
import Animated, { FadeIn } from "react-native-reanimated";
import { DynamicProcessingView } from "@/components/ProcessingView";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState(false);
  const { cameraRef, takePicture, isCapturing, isCameraActive } = useCamera();
  const router = useRouter();

  const {
    uploadImage,
    isProcessing,
    processingStep,
    processingSteps,
    processedImageUri,
    isSuccess,
    eventId,
    resetUpload,
  } = useImageUpload();

  const handleCapture = async () => {
    const imageUri = await takePicture();
    if (imageUri) {
      await uploadImage(imageUri);
    }
  };

  const handleNewScan = () => {
    resetUpload();
  };

  // Handle camera permission request
  if (!hasPermission) {
    return <CameraPermission onPermissionGranted={() => setHasPermission(true)} />;
  }

  // Don't render when not on this screen
  if (!isCameraActive) {
    return null;
  }

  // Show success screen after processing
  if (isSuccess && processedImageUri) {
    return (
      <SuccessScreen
        imageUri={processedImageUri}
        onNewScan={handleNewScan}
        eventId={eventId || undefined}
      />
    );
  }

  // Show dynamic processing view while uploading
  if (isProcessing) {
    return <DynamicProcessingView progressSteps={processingSteps} currentStep={processingStep} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={styles.header} entering={FadeIn.duration(500)}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/")}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Scan Document</Text>
      </Animated.View>

      <Animated.View style={styles.contentContainer} entering={FadeIn.duration(800)}>
        <CameraView ref={cameraRef} style={styles.camera}>
          <ScannerOverlay />
        </CameraView>
      </Animated.View>

      <CaptureButton onPress={handleCapture} isCapturing={isCapturing} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#333",
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    fontFamily: "mono",
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    color: "#FFF",
    fontSize: 18,
    fontFamily: "BungeeInline",
    textAlign: "center",
    marginRight: 24, // To offset the back button width for perfect centering
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  contentContainer: {
    flex: 1,
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
    borderRadius: 10,
  },
});
