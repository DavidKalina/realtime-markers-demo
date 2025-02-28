import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Camera, X, RefreshCw, Zap, Image } from "lucide-react-native";
import { styles } from "./styles";

interface CameraViewProps {
  onClose: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onClose }) => {
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(false);

  const startScan = () => {
    setScanning(true);
    // Simulate scan completion after 2 seconds
    setTimeout(() => {
      setScanning(false);
    }, 2000);
  };

  return (
    <View style={styles.cameraOverlayContainer}>
      <View style={styles.cameraViewfinder}>
        {scanning && <View style={styles.scanLine} />}

        <View style={styles.scanCorner1} />
        <View style={styles.scanCorner2} />
        <View style={styles.scanCorner3} />
        <View style={styles.scanCorner4} />

        <View style={styles.scanInstructions}>
          <Text style={styles.scanText}>
            {scanning ? "Scanning..." : "Position QR code or event poster in frame"}
          </Text>
        </View>
      </View>

      <View style={styles.cameraControls}>
        <TouchableOpacity style={styles.cameraControlButton} onPress={() => setFlash(!flash)}>
          <Zap size={20} color={flash ? "#fcd34d" : "#cbd5e1"} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cameraCaptureButton}
          onPress={startScan}
          disabled={scanning}
        >
          <Camera size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.cameraControlButton}>
          <Image size={20} color="#cbd5e1" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cameraCloseButton} onPress={onClose}>
        <X size={20} color="#fcd34d" />
      </TouchableOpacity>

      {scanning && (
        <View style={styles.scanningOverlay}>
          <RefreshCw size={24} color="#fcd34d" style={styles.spinningIcon} />
          <Text style={styles.scanningText}>Scanning for events...</Text>
        </View>
      )}
    </View>
  );
};
