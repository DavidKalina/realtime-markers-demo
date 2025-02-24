import { CameraPermission } from "@/components/CameraPermission";
import { CaptureButton } from "@/components/CaptureButton";
import { DynamicProcessingView } from "@/components/ProcessingView";
import { ScannerOverlay } from "@/components/ScannerOverlay";
import { SuccessScreen } from "@/components/SuccessScreen";
import { useCamera } from "@/hooks/useCamera";
import { useImageUpload } from "@/hooks/useImageUpload";
import { CameraView } from "expo-camera";
import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const ScanScreen: React.FC = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const { cameraRef, takePicture, isCapturing, isPermissionLoading, isCameraActive } = useCamera();

  const {
    uploadImage,
    isProcessing,
    processingStep,
    processingSteps,
    processedImageUri,
    isSuccess,
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
        eventName="Document Successfully Processed"
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
};

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
  },
  headerText: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "BungeeInline",
    textAlign: "center",
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

export default ScanScreen;
