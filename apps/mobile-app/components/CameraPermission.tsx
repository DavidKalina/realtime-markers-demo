import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useCameraPermissions, PermissionStatus } from "expo-camera";
import { MorphingLoader } from "@/components/MorphingLoader";
import Animated, { ZoomIn } from "react-native-reanimated";
import * as Linking from "expo-linking";

interface CameraPermissionProps {
  onPermissionGranted: () => void;
}

export const CameraPermission: React.FC<CameraPermissionProps> = ({ onPermissionGranted }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);

  // Use useEffect to handle permission state changes safely
  useEffect(() => {
    if (permission?.granted) {
      // Add a small delay to ensure the component is fully mounted
      // before triggering the callback
      const timer = setTimeout(() => {
        onPermissionGranted();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [permission?.granted, onPermissionGranted]);

  // Handle permission request with error handling
  const handleRequestPermission = async () => {
    try {
      setIsProcessing(true);
      await requestPermission();
      // Don't call onPermissionGranted directly here
      // Let the useEffect handle it when permission state updates
    } catch (error) {
      console.error("Error requesting camera permission:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!permission) {
    return (
      <Animated.View style={styles.processingContainer} entering={ZoomIn.duration(500)}>
        <MorphingLoader size={80} color="#69db7c" />
        <Text style={styles.processingText}>Initializing camera...</Text>
      </Animated.View>
    );
  }

  if (isProcessing) {
    return (
      <Animated.View style={styles.processingContainer} entering={ZoomIn.duration(500)}>
        <MorphingLoader size={80} color="#69db7c" />
        <Text style={styles.processingText}>Processing permission request...</Text>
      </Animated.View>
    );
  }

  if (!permission.granted) {
    return (
      <Animated.View style={styles.permissionContainer} entering={ZoomIn.duration(500)}>
        <Text style={styles.permissionMessage}>Camera access required</Text>
        <Text style={styles.permissionSubtext}>
          We need camera access to continue. Your privacy is important to us.
        </Text>

        {permission.canAskAgain ? (
          <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
            <Text style={styles.permissionButtonText}>Grant Access</Text>
          </TouchableOpacity>
        ) : (
          // Show this when user has previously denied and needs to enable manually
          <View style={styles.manualPermissionContainer}>
            <Text style={styles.manualPermissionText}>
              Please enable camera access in your device settings to continue.
            </Text>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                // Open app settings
                Linking.openSettings();
              }}
            >
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                // Try requesting again (in case the user enabled it manually)
                requestPermission();
              }}
            >
              <Text style={styles.retryButtonText}>Check Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    );
  }

  // If permission is granted, render a minimal loading state instead of null
  // This helps prevent immediate re-renders that could cause crashes
  return <View style={styles.invisibleContainer} />;
};

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionMessage: {
    fontSize: 18,
    color: "#FFF",
    marginBottom: 12,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  permissionSubtext: {
    fontSize: 14,
    color: "#CCC",
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  permissionButton: {
    backgroundColor: "#69db7c",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 10,
    elevation: 2,
  },
  permissionButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "BungeeInline",
  },
  manualPermissionContainer: {
    alignItems: "center",
    width: "100%",
  },
  manualPermissionText: {
    fontSize: 14,
    color: "#FFF",
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  settingsButton: {
    backgroundColor: "#69db7c",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 10,
    elevation: 2,
    marginBottom: 12,
    width: "80%",
    alignItems: "center",
  },
  settingsButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "BungeeInline",
  },
  retryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#69db7c",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 8,
  },
  retryButtonText: {
    color: "#69db7c",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  processingContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    marginTop: 16,
    fontSize: 18,
    color: "#FFF",
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },
  invisibleContainer: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
