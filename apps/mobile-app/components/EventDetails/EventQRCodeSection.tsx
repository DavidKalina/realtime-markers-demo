import { Info, ExternalLink, QrCode } from "lucide-react-native";
import React from "react";
import { View, TouchableOpacity, Linking, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { EventType } from "@/types/types";
import useEventAnalytics from "@/hooks/useEventAnalytics";

interface EventQRCodeSection {
  event: EventType;
}

const EventQRCodeSection: React.FC<EventQRCodeSection> = ({ event }) => {
  const eventAnalytics = useEventAnalytics();

  const handleOpenLink = () => {
    const url = event.qrCodeData || event.detectedQrData;

    if (url && url.startsWith("http")) {
      try {
        Linking.openURL(url);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Track QR code link click with error handling
        if (url) {
          eventAnalytics.trackQRCodeLinkClick(event, url);
        }
      } catch (error) {
        console.error("Error opening QR code link:", error);
      }
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

        <Text style={styles.qrSourceText}>
          {event.qrDetectedInImage
            ? "This QR code was detected in the original event flyer"
            : "Scan this QR code to access the event"}
        </Text>

        <TouchableOpacity style={styles.qrLinkButton} onPress={handleOpenLink} activeOpacity={0.7}>
          <View style={styles.buttonContent}>
            <ExternalLink size={18} color="#93c5fd" />
            <Text style={styles.qrLinkButtonText}>Open QR Code Link</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  qrCodeSection: {
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },

  cardContent: {
    alignItems: "center",
  },

  qrCodeContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },

  qrCodeInner: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
  },

  qrSourceText: {
    color: "#a0a0a0",
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  qrLinkButtonText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginLeft: 8,
    letterSpacing: 0.5,
  },
});

export default React.memo(EventQRCodeSection);
