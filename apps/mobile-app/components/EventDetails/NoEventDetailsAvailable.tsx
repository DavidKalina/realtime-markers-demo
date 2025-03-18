import React from "react";
import { View, Text } from "react-native";
import { styles } from "./styles";

const NoEventDetailsAvailable = () => {
  return (
    <View style={styles.noResults}>
      <Text style={styles.noResultsText}>No event details available</Text>
    </View>
  );
};

export default NoEventDetailsAvailable;
