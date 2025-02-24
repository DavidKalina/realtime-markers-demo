import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useCameraPermissions } from "expo-camera";
import { MorphingLoader } from "@/components/MorphingLoader";
import Animated, { ZoomIn } from "react-native-reanimated";

interface CameraPermissionProps {
  onPermissionGranted: () => void;
}

export const CameraPermission: React.FC<CameraPermissionProps> = ({ onPermissionGranted }) => {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return (
      <Animated.View style={styles.processingContainer} entering={ZoomIn.duration(500)}>
        <MorphingLoader size={80} color="#69db7c" />
        <Text style={styles.processingText}>Processing...</Text>
      </Animated.View>
    );
  }

  if (!permission.granted) {
    return (
      <Animated.View style={styles.permissionContainer} entering={ZoomIn.duration(500)}>
        <Text style={styles.permissionMessage}>Camera access required</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={async () => {
            await requestPermission();
            if (permission.granted) {
              onPermissionGranted();
            }
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Permission is granted, call the callback
  onPermissionGranted();
  return null;
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
    marginBottom: 24,
    textAlign: "center",
    fontWeight: "500",
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
});
