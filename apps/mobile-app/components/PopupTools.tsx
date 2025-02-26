import React from "react";
import { TouchableOpacity, Text, StyleSheet, View, Platform } from "react-native";

interface PopupToolsProps {
  markerId: string;
  title: string;
  onShare?: () => void;
  onGetDirections?: () => void;
  onViewDetails?: () => void;
}

const PopupTools: React.FC<PopupToolsProps> = ({
  markerId,
  title,
  onShare,
  onGetDirections,
  onViewDetails,
}) => {
  return (
    <View style={styles.popupContainer}>
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>{title}</Text>
      </View>
      <View style={styles.buttonsContainer}>
        {onShare && (
          <TouchableOpacity style={styles.popupButton} onPress={onShare} activeOpacity={0.7}>
            <Text style={styles.emojiText}>🔗</Text>
          </TouchableOpacity>
        )}
        {onGetDirections && (
          <TouchableOpacity
            style={styles.popupButton}
            onPress={onGetDirections}
            activeOpacity={0.7}
          >
            <Text style={styles.emojiText}>🧭</Text>
          </TouchableOpacity>
        )}
        {onViewDetails && (
          <TouchableOpacity style={styles.popupButton} onPress={onViewDetails} activeOpacity={0.7}>
            <Text style={styles.emojiText}>ℹ️</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  popupContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 14,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    minWidth: 140,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
    ...(Platform.OS === "web" ? { backdropFilter: "blur(8px)" } : {}),
  },
  titleContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
    paddingBottom: 4,
    marginBottom: 6,
  },
  titleText: {
    fontFamily: "SpaceMono",
    color: "#333",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  popupButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.02)",
    justifyContent: "center",
    alignItems: "center",
    margin: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  emojiText: {
    fontSize: 16,
    lineHeight: 20,
  },
});

export default PopupTools;
