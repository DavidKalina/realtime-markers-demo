// ScanView.tsx - Clean, minimal scanner using ScannerOverlay component
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ArrowLeft, Camera, Image, Zap } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { CameraView } from "expo-camera";
import { styles } from "./styles";
import { EventType } from "./types";
import { useCamera } from "@/hooks/useCamera";
import ScannerOverlay from "./ScannerOverlay";

interface ScanViewProps {
  isVisible: boolean;
  onClose: () => void;
  onScanComplete?: (event: EventType) => void;
}

export const ScanView: React.FC<ScanViewProps> = ({ isVisible, onClose, onScanComplete }) => {
  // Animation value
  const animationProgress = useSharedValue(0);

  // Camera states
  const { cameraRef, takePicture, hasPermission, isCameraReady, onCameraReady } = useCamera();

  // UI states
  const [flash, setFlash] = useState(false);
  const [isAligned, setIsAligned] = useState(true); // Setting to true to match screenshot
  const [processingStatus, setProcessingStatus] = useState<
    "none" | "processing" | "complete" | "error"
  >("none");

  // Animation effect
  useEffect(() => {
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    animationProgress.value = withTiming(isVisible ? 1 : 0, {
      duration: 350,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isVisible]);

  // Container animation style
  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      transform: [
        { translateY: (1 - animationProgress.value) * 50 },
        { scale: 0.9 + animationProgress.value * 0.1 },
      ],
    };
  });

  // Simulate alignment changes - for demo purposes
  useEffect(() => {
    if (isVisible && processingStatus === "none") {
      // Simulate perfect alignment for the screenshot
      setIsAligned(true);
    }
  }, [isVisible, processingStatus]);

  // Handle capture
  const handleCapture = async () => {
    if (processingStatus !== "none" || !isCameraReady) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessingStatus("processing");

    try {
      const uri = await takePicture();

      if (uri) {
        // Simulate processing
        setTimeout(() => {
          setProcessingStatus("complete");

          // Create a mock event from the scan
          const mockEvent = {
            emoji: "🎸",
            title: "Scanned Event",
            description: "This event was created by scanning a flyer.",
            location: "Scanned Venue",
            time: "Friday, 8:00 PM",
            distance: "1.5 miles away",
            categories: ["Music", "Festival"],
          };

          // Call the onScanComplete callback if provided
          if (onScanComplete) {
            onScanComplete(mockEvent);
          }

          // Close the scan view after a short delay
          setTimeout(() => {
            onClose();
            // Reset states
            setTimeout(() => {
              setProcessingStatus("none");
            }, 500);
          }, 1000);
        }, 1500);
      } else {
        setProcessingStatus("error");
        setTimeout(() => setProcessingStatus("none"), 2000);
      }
    } catch (error) {
      console.error("Scan failed:", error);
      setProcessingStatus("error");
      setTimeout(() => setProcessingStatus("none"), 2000);
    }
  };

  // Toggle flash
  const toggleFlash = () => {
    Haptics.selectionAsync();
    setFlash(!flash);
  };

  // Close handler
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Don't render if not visible
  if (!isVisible && animationProgress.value === 0) {
    return null;
  }

  // Permission denied
  if (hasPermission === false) {
    return (
      <Animated.View style={[styles.detailsScreenContainer, containerAnimatedStyle]}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={handleClose}>
            <ArrowLeft size={22} color="#f8f9fa" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Event</Text>
        </View>

        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Camera permission is required to scan event flyers.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginTop: 24 }]}
            onPress={onClose}
          >
            <Text style={styles.primaryButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.detailsScreenContainer, containerAnimatedStyle]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Event</Text>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        {/* Camera */}
        <View style={styles.cameraView}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            onCameraReady={onCameraReady}
            flash={flash ? "on" : "off"}
          />

          {/* Scanner Overlay Component */}
          <ScannerOverlay
            isVisible={isVisible}
            isAligned={isAligned}
            processingStatus={processingStatus}
          />

          {/* Controls Section - Clear visual separation at bottom */}
          <View style={styles.controlsSection}>
            <View style={styles.controlsContainer}>
              {/* Flash button with label */}
              <View style={styles.controlButtonWrapper}>
                <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
                  <Zap size={20} color={flash ? "#fcd34d" : "#f8f9fa"} />
                </TouchableOpacity>
                <Text style={styles.controlButtonLabel}>Flash</Text>
              </View>

              {/* Capture button with label */}
              <View style={styles.captureButtonWrapper}>
                <TouchableOpacity
                  style={[
                    styles.captureButton,
                    isAligned && processingStatus === "none" && styles.captureReady,
                  ]}
                  onPress={handleCapture}
                  disabled={processingStatus !== "none"}
                >
                  <Camera size={24} color="#f8f9fa" />
                </TouchableOpacity>
                <Text style={styles.captureLabel}>
                  {processingStatus === "processing" ? "Scanning..." : "Capture"}
                </Text>
              </View>

              {/* Gallery button with label */}
              <View style={styles.controlButtonWrapper}>
                <TouchableOpacity style={styles.controlButton}>
                  <Image size={20} color="#f8f9fa" />
                </TouchableOpacity>
                <Text style={styles.controlButtonLabel}>Gallery</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};
