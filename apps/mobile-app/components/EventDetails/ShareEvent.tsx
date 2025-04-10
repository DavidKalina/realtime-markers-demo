import { Share2 } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  // Container styling
  bottomButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "#1a1a1a",
  },

  // Button with gradient background
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  // Button content container
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  // Icon container
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  // Text styling
  shareButtonText: {
    color: "#93c5fd",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
});

const ShareEvent = ({ handleShare }: { handleShare: () => void }) => {
  return (
    <View style={styles.bottomButtonContainer}>
      <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.7}>
        <View style={styles.buttonContent}>
          <View style={styles.iconContainer}>
            <Share2 size={20} color="#93c5fd" />
          </View>
          <Text style={styles.shareButtonText}>Share Event</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(ShareEvent);
