import { Feather } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

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
        // Add a timeout to prevent getting stuck
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Permission check timed out")), 5000);
        });

        // Race between permission check and timeout
        const result = (await Promise.race([requestPermission(), timeoutPromise])) as {
          granted: boolean;
          canAskAgain: boolean;
        };

        if (!result.granted) {
          setIsProcessing(false);
        }
      } catch (error) {
        console.error("Initial permission check failed:", error);
        // Reset processing state if we get an error
        setIsProcessing(false);
      }
    };

    checkInitialPermission();
  }, [requestPermission]);

  // Monitor for app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && hasSettingsOpened) {
        setHasSettingsOpened(false);

        // Check if permissions have changed with timeout
        const checkPermissionWithTimeout = async () => {
          try {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Permission check timed out")), 5000);
            });

            const result = (await Promise.race([requestPermission(), timeoutPromise])) as {
              granted: boolean;
              canAskAgain: boolean;
            };

            if (result.granted) {
              onPermissionGranted();
            }
          } catch (err) {
            console.error("Error checking permissions:", err);
            setIsProcessing(false);
          }
        };

        setTimeout(checkPermissionWithTimeout, 500);
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

  // Handle permission request with error handling and timeout
  const handleRequestPermission = async () => {
    try {
      setIsProcessing(true);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Permission request timed out")), 5000);
      });

      const result = (await Promise.race([requestPermission(), timeoutPromise])) as {
        granted: boolean;
        canAskAgain: boolean;
      };

      // If permission was denied and can't ask again, we'll need to go to settings
      if (!result.granted && !result.canAskAgain) {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      setIsProcessing(false);
    }
  };

  // Custom retry using the provided retry function with timeout
  const handleRetryPermission = async () => {
    if (onRetryPermission) {
      setIsProcessing(true);

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Permission retry timed out")), 5000);
        });

        const granted = (await Promise.race([onRetryPermission(), timeoutPromise])) as boolean;

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
        setCheckCount((prev) => prev + 1);
      }
    } else {
      // Fall back to regular permission check with timeout
      setIsProcessing(true);
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Permission check timed out")), 5000);
        });

        const result = (await Promise.race([requestPermission(), timeoutPromise])) as {
          granted: boolean;
          canAskAgain: boolean;
        };

        if (!result.granted) {
          setIsProcessing(false);
        }
      } catch (error) {
        console.error("Error during permission check:", error);
        setIsProcessing(false);
      } finally {
        setTimeout(() => {
          setCheckCount((prev) => prev + 1);
        }, 500);
      }
    }
  };

  // Custom animation styles
  const iconContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withRepeat(
            withSequence(
              withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
              withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
          ),
        },
      ],
    };
  });

  // If we're waiting for the permission check
  if (permission === undefined) {
    return (
      <Animated.View
        style={styles.processingContainer}
        entering={FadeIn.duration(400).easing(Easing.out(Easing.ease))}
      >
        <ActivityIndicator size="large" color="#69db7c" />
        <Animated.Text
          style={styles.processingText}
          entering={FadeInDown.duration(400).delay(200).easing(Easing.out(Easing.ease))}
        >
          Checking camera permissions...
        </Animated.Text>
      </Animated.View>
    );
  }

  // If we're processing the permission request
  if (isProcessing) {
    return (
      <Animated.View
        style={styles.processingContainer}
        entering={FadeIn.duration(400).easing(Easing.out(Easing.ease))}
      >
        <ActivityIndicator size="large" color="#69db7c" />
        <Animated.Text
          style={styles.processingText}
          entering={FadeInDown.duration(400).delay(200).easing(Easing.out(Easing.ease))}
        >
          {permission?.granted ? "Camera ready!" : "Processing permission request..."}
        </Animated.Text>
      </Animated.View>
    );
  }

  // If permission is not granted
  if (!permission?.granted) {
    return (
      <Animated.View
        style={styles.permissionContainer}
        entering={FadeIn.duration(400).easing(Easing.out(Easing.ease))}
      >
        <Animated.View style={[styles.iconContainer, iconContainerStyle]}>
          <Feather name="camera-off" size={64} color="#f8f9fa" />
        </Animated.View>

        <Animated.Text
          style={styles.permissionMessage}
          entering={FadeInDown.duration(400).delay(200).easing(Easing.out(Easing.ease))}
        >
          Camera access required
        </Animated.Text>

        <Animated.Text
          style={styles.permissionSubtext}
          entering={FadeInDown.duration(400).delay(300).easing(Easing.out(Easing.ease))}
        >
          We need camera access to scan documents. Your privacy is important to us.
        </Animated.Text>

        {permission?.canAskAgain ? (
          <Animated.View
            entering={FadeInUp.duration(400).delay(400).easing(Easing.out(Easing.ease))}
          >
            <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
              <Text style={styles.permissionButtonText}>Grant Access</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View
            style={styles.manualPermissionContainer}
            entering={FadeInUp.duration(400).delay(400).easing(Easing.out(Easing.ease))}
          >
            <Text style={styles.manualPermissionText}>
              Please enable camera access in your device settings to continue.
            </Text>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                setHasSettingsOpened(true);
                Linking.openSettings();
              }}
            >
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.retryButton} onPress={handleRetryPermission}>
              <Text style={styles.retryButtonText}>Check Again</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {hasSettingsOpened && (
          <Animated.Text
            style={styles.returnHint}
            entering={FadeIn.duration(300).delay(500).easing(Easing.out(Easing.ease))}
          >
            If you've enabled camera access, please tap "Check Again"
          </Animated.Text>
        )}

        {checkCount > 2 && !hasSettingsOpened && (
          <Animated.Text
            style={styles.returnHint}
            entering={FadeIn.duration(300).delay(500).easing(Easing.out(Easing.ease))}
          >
            Having trouble? Try restarting the app or your device.
          </Animated.Text>
        )}
      </Animated.View>
    );
  }

  // If permission is granted, we show a transition screen
  return (
    <Animated.View
      style={styles.processingContainer}
      entering={FadeIn.duration(400).easing(Easing.out(Easing.ease))}
    >
      <Animated.View entering={FadeInDown.duration(400).delay(200).easing(Easing.out(Easing.ease))}>
        <Feather name="check-circle" size={64} color="#69db7c" />
      </Animated.View>
      <Animated.Text
        style={styles.processingText}
        entering={FadeInUp.duration(400).delay(300).easing(Easing.out(Easing.ease))}
      >
        Camera permission granted!
      </Animated.Text>
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
