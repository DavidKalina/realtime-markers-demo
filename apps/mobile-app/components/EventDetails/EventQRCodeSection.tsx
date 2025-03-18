import { Info, ExternalLink } from "lucide-react-native";
import React from "react";
import { View, TouchableOpacity, Linking, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { styles } from "./styles";
import * as Haptics from "expo-haptics";
import { EventType } from "@/types/types";

interface EventQRCodeSection {
  event: EventType;
}

const EventQRCodeSection: React.FC<EventQRCodeSection> = ({ event }) => {
  return (
    <View style={styles.qrCodeSection}>
      <View style={styles.resultDetailsRow}>
        <Info size={16} color="#93c5fd" style={{ marginRight: 8 }} />
        <Text style={styles.detailLabel}>
          {event.qrDetectedInImage ? "Original Event QR Code" : "Event QR Code"}
        </Text>
      </View>

      <View style={styles.qrCodeContainer}>
        <QRCode
          value={event.qrCodeData || event.detectedQrData}
          size={180}
          backgroundColor="#ffffff"
          color="#000000"
        />
      </View>

      <Text style={styles.qrSourceText}>
        {event.qrDetectedInImage
          ? "This QR code was detected in the original event flyer"
          : "Scan this QR code to access the event"}
      </Text>

      <TouchableOpacity
        style={styles.qrLinkButton}
        onPress={() => {
          const url = event.qrCodeData || event.detectedQrData;
          if (url && url.startsWith("http")) {
            Linking.openURL(url);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }}
      >
        <ExternalLink size={16} color="#f8f9fa" style={{ marginRight: 8 }} />
        <Text style={styles.qrLinkButtonText}>Open QR Code Link</Text>
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(EventQRCodeSection);
