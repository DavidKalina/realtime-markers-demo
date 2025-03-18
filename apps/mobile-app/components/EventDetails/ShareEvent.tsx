import { Share2 } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  // Container styling
  bottomButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#3a3a3a",
    backgroundColor: "#333",
  },

  // Button with gradient background
  shareButton: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  // Button gradient
  buttonGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  // Button content container
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // Icon container
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  // Text styling
  shareButtonText: {
    color: "#f8f9fa",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
});

const ShareEvent = ({ handleShare }: { handleShare: () => void }) => {
  return (
    <View style={styles.bottomButtonContainer}>
      <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.85}>
        <View style={styles.buttonContent}>
          <View style={styles.iconContainer}>
            <Share2 size={20} color="#ffffff" />
          </View>
          <Text style={styles.shareButtonText}>Share Event</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(ShareEvent);
