import React from "react";
import { styles } from "./styles";
import { View, Text } from "react-native";

const SaveCount = ({ saveCount }: { saveCount: number }) => {
  return (
    <View style={styles.saveCountContainer}>
      <Text style={styles.saveCountText}>
        {saveCount} {saveCount === 1 ? "person" : "people"} saved this event
      </Text>
    </View>
  );
};

export default React.memo(SaveCount);
