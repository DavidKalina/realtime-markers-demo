import { Info, ExternalLink, QrCode } from "lucide-react-native";
import React from "react";
import { View, TouchableOpacity, Linking, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { EventType } from "@/types/types";

interface EventQRCodeSection {
  event: EventType;
}

const EventQRCodeSection: React.FC<EventQRCodeSection> = ({ event }) => {
  const handleOpenLink = () => {
    const url = event.qrCodeData || event.detectedQrData;
    if (url && url.startsWith("http")) {
      Linking.openURL(url);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <View style={styles.qrCodeSection}>

      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <QrCode size={20} color="#93c5fd" />
        </View>
        <Text style={styles.cardTitle}>
          {event.qrDetectedInImage ? "Original Event QR Code" : "Event QR Code"}
        </Text>
      </View>

      <View style={styles.cardContent}>
        {/* QR code with improved container */}
        <View style={styles.qrCodeContainer}>
          <View style={styles.qrCodeInner}>
            <QRCode
              value={event.qrCodeData || event.detectedQrData || ""}
              size={180}
              backgroundColor="#ffffff"
              color="#000000"
            />
          </View>
        </View>

        {/* Informational text */}
        <Text style={styles.qrSourceText}>
          {event.qrDetectedInImage
            ? "This QR code was detected in the original event flyer"
            : "Scan this QR code to access the event"}
        </Text>

        {/* Action button */}
        <TouchableOpacity style={styles.qrLinkButton} onPress={handleOpenLink} activeOpacity={0.7}>
          <View style={styles.buttonContent}>
            <ExternalLink size={18} color="#f8f9fa" />
            <Text style={styles.qrLinkButtonText}>Open QR Code Link</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  qrCodeSection: {
    marginTop: 24,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },

  cardContent: {
    alignItems: "center",
  },

  qrCodeContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(50, 50, 50, 0.7)",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  qrCodeInner: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
  },

  qrSourceText: {
    color: "#93c5fd",
    fontSize: 14,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },

  qrLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  qrLinkButtonText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginLeft: 6,
  },
});

export default React.memo(EventQRCodeSection);
