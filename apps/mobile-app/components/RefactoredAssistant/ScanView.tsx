import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Camera, RefreshCcw, Upload } from "lucide-react-native";
import { styles } from "./styles";

interface ScanViewProps {
  onUploadSuccess?: (eventData: any) => void;
}

const ScanView: React.FC<ScanViewProps> = ({ onUploadSuccess }) => {
  // UI state management
  const [scanState, setScanState] = useState<
    "permission" | "scanning" | "preview" | "uploading" | "success" | "error"
  >("permission");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle permission request (UI only for now)
  const requestCameraPermission = () => {
    // This will be replaced with actual permission logic later
    setScanState("scanning");
  };

  // Handle taking a photo (UI only for now)
  const handleCapture = () => {
    // Simulate capturing a photo
    setScanState("preview");
    setPreviewImage("https://placekitten.com/400/600"); // Placeholder image URL
  };

  // Handle retaking a photo
  const handleRetake = () => {
    setPreviewImage(null);
    setScanState("scanning");
  };

  // Handle photo upload (UI only for now)
  const handleUpload = () => {
    setScanState("uploading");

    // Simulate upload process
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setScanState("success");

        // Simulate successful upload data
        if (onUploadSuccess) {
          onUploadSuccess({
            id: "event_123",
            title: "Community Festival",
            date: "2025-03-15",
            time: "12:00 PM - 8:00 PM",
            location: "City Park",
            description: "Join us for food, music, and fun activities for the whole family!",
            organizer: "City Community Center",
            categories: ["Festival", "Family", "Outdoor"],
          });
        }
      }
    }, 300);
  };

  // Render different UI based on scan state
  if (scanState === "permission") {
    return (
      <View style={styles.actionContent}>
        <View style={styles.centeredContent}>
          <Camera size={64} color="#4dabf7" style={styles.iconLarge} />
          <Text style={styles.sectionTitle}>Camera Access Required</Text>
          <Text style={styles.description}>
            We need camera access to scan event flyers and provide you with event details.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestCameraPermission}>
            <Text style={styles.primaryButtonText}>Allow Camera Access</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (scanState === "scanning") {
    return (
      <View style={styles.actionContent}>
        <View style={scanStyles.scanContainer}>
          {/* Camera frame overlay */}
          <View style={scanStyles.cameraFrame}>
            <View style={scanStyles.cornerTL} />
            <View style={scanStyles.cornerTR} />
            <View style={scanStyles.cornerBL} />
            <View style={scanStyles.cornerBR} />
          </View>

          <View style={scanStyles.instructionBox}>
            <Text style={scanStyles.instructionText}>
              Position the event flyer within the frame
            </Text>
          </View>

          <TouchableOpacity style={scanStyles.captureButton} onPress={handleCapture}>
            <View style={scanStyles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (scanState === "preview") {
    return (
      <View style={styles.actionContent}>
        <View style={scanStyles.previewContainer}>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={scanStyles.previewImage}
              resizeMode="contain"
            />
          )}

          <View style={scanStyles.previewActions}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleRetake}
            >
              <RefreshCcw size={16} color="#4287f5" style={styles.buttonIcon} />
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleUpload}>
              <Upload size={16} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Upload</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (scanState === "uploading") {
    return (
      <View style={styles.actionContent}>
        <View style={styles.centeredContent}>
          <Text style={styles.sectionTitle}>Uploading Image</Text>
          <View style={scanStyles.progressBarContainer}>
            <View style={[scanStyles.progressBar, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={styles.description}>{uploadProgress}% Complete</Text>
        </View>
      </View>
    );
  }

  if (scanState === "success") {
    return (
      <View style={styles.actionContent}>
        <View style={styles.centeredContent}>
          <View style={scanStyles.successIcon}>
            <Text style={scanStyles.successIconText}>✓</Text>
          </View>
          <Text style={styles.sectionTitle}>Upload Successful!</Text>
          <Text style={styles.description}>
            We're processing your image to extract event details.
          </Text>
        </View>
      </View>
    );
  }

  if (scanState === "error") {
    return (
      <View style={styles.actionContent}>
        <View style={styles.centeredContent}>
          <View style={scanStyles.errorIcon}>
            <Text style={scanStyles.errorIconText}>!</Text>
          </View>
          <Text style={styles.sectionTitle}>Upload Failed</Text>
          <Text style={styles.description}>
            {errorMessage || "There was a problem uploading your image. Please try again."}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setScanState("scanning")}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Default fallback
  return (
    <View style={styles.actionContent}>
      <Text>Preparing scanner...</Text>
    </View>
  );
};

// Additional scan-specific styles
const scanStyles = StyleSheet.create({
  scanContainer: {
    height: 450,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
    borderRadius: 8,
    overflow: "hidden",
  },
  cameraFrame: {
    width: 250,
    height: 350,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
  },
  cornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
  },
  instructionBox: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
    borderRadius: 8,
  },
  instructionText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 16,
  },
  captureButton: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
  },
  previewContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    overflow: "hidden",
  },
  previewImage: {
    flex: 1,
    width: "100%",
    height: undefined,
    aspectRatio: 0.7,
    alignSelf: "center",
  },
  previewActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#e9ecef",
    borderRadius: 4,
    marginVertical: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#4287f5",
    borderRadius: 4,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#40c057",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successIconText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fa5252",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  errorIconText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },
});

export default ScanView;
