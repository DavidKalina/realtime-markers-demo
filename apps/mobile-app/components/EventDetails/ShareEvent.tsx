import { Share2 } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View, Text } from "react-native";
import { styles } from "./styles";

const ShareEvent = ({ handleShare }: { handleShare: () => void }) => {
  return (
    <View style={styles.bottomButtonContainer}>
      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Share2 size={20} color="#f8f9fa" style={{ marginRight: 8 }} />
        <Text style={styles.shareButtonText}>Share Event</Text>
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(ShareEvent);
