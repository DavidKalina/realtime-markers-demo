import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { useCameraPermissions } from "expo-camera";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as Linking from "expo-linking";
import { AppState } from "react-native";
import { Feather } from "@expo/vector-icons";

interface CameraPermissionProps {
  onPermissionGranted: () => void;
  onRetryPermission?: () => Promise<boolean>;
}

export const CameraPermission: React.FC<CameraPermissionProps> = ({
  onPermissionGranted,
  onRetryPermission,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSettingsOpened, setHasSettingsOpened] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  // Check permission state immediately when component mounts
  useEffect(() => {
    const checkInitialPermission = async () => {
      try {
        // Force a permission check on mount
        await requestPermission();
      } catch (error) {
        console.error("Initial permission check failed:", error);
      }
    };

    checkInitialPermission();
  }, [requestPermission]);

  // Monitor for app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && hasSettingsOpened) {
        setHasSettingsOpened(false);

        // Check if permissions have changed
        setTimeout(() => {
          requestPermission()
            .then((result) => {
              if (result.granted) {
                onPermissionGranted();
              }
            })
            .catch((err) => {
              console.error("Error checking permissions:", err);
            });
        }, 500);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hasSettingsOpened, onPermissionGranted, requestPermission]);

  // Use useEffect to handle permission state changes safely
  useEffect(() => {
    if (permission?.granted) {
      // Small delay to ensure smooth transition
      setIsProcessing(true);

      const timer = setTimeout(() => {
        onPermissionGranted();
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [permission?.granted, onPermissionGranted]);

  // Handle permission request with error handling
  const handleRequestPermission = async () => {
    try {
      setIsProcessing(true);
      const result = await requestPermission();

      // If permission was denied and can't ask again, we'll need to go to settings
      if (!result.granted && !result.canAskAgain) {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      setIsProcessing(false);
    }
  };

  // Custom retry using the provided retry function
  const handleRetryPermission = async () => {
    if (onRetryPermission) {
      setIsProcessing(true);

      try {
        const granted = await onRetryPermission();
        if (granted) {
          // If successful, call the granted callback
          onPermissionGranted();
        } else {
          setIsProcessing(false);
          setCheckCount((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Error during permission retry:", error);
        setIsProcessing(false);
      }
    } else {
      // Fall back to regular permission check
      setIsProcessing(true);
      requestPermission().finally(() => {
        setTimeout(() => {
          setIsProcessing(false);
          setCheckCount((prev) => prev + 1);
        }, 500);
      });
    }
  };

  // If we're waiting for the permission check
  if (permission === undefined) {
    return (
      <Animated.View style={styles.processingContainer} entering={ZoomIn.duration(500)}>
        <ActivityIndicator size="large" color="#69db7c" />
        <Text style={styles.processingText}>Checking camera permissions...</Text>
      </Animated.View>
    );
  }

  // If we're processing the permission request
  if (isProcessing) {
    return (
      <Animated.View style={styles.processingContainer} entering={FadeIn.duration(500)}>
        <ActivityIndicator size="large" color="#69db7c" />
        <Text style={styles.processingText}>
          {permission?.granted ? "Camera ready!" : "Processing permission request..."}
        </Text>
      </Animated.View>
    );
  }

  // If permission is not granted
  if (!permission?.granted) {
    return (
      <Animated.View style={styles.permissionContainer} entering={ZoomIn.duration(500)}>
        <View style={styles.iconContainer}>
          <Feather name="camera-off" size={64} color="#f8f9fa" />
        </View>

        <Text style={styles.permissionMessage}>Camera access required</Text>
        <Text style={styles.permissionSubtext}>
          We need camera access to scan documents. Your privacy is important to us.
        </Text>

        {permission?.canAskAgain ? (
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
                setHasSettingsOpened(true);
                Linking.openSettings();
              }}
            >
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.retryButton} onPress={handleRetryPermission}>
              <Text style={styles.retryButtonText}>Check Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasSettingsOpened && (
          <Animated.Text style={styles.returnHint} entering={FadeIn.duration(300)}>
            If you've enabled camera access, please tap "Check Again"
          </Animated.Text>
        )}

        {checkCount > 2 && !hasSettingsOpened && (
          <Animated.Text style={styles.returnHint} entering={FadeIn.duration(300)}>
            Having trouble? Try restarting the app or your device.
          </Animated.Text>
        )}
      </Animated.View>
    );
  }

  // If permission is granted, we show a transition screen
  return (
    <Animated.View style={styles.processingContainer} entering={FadeIn.duration(500)}>
      <Feather name="check-circle" size={64} color="#69db7c" />
      <Text style={styles.processingText}>Camera permission granted!</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
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
  returnHint: {
    marginTop: 24,
    fontSize: 14,
    color: "#FFF",
    textAlign: "center",
    fontFamily: "SpaceMono",
    opacity: 0.8,
  },
});
