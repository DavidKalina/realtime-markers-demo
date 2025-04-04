import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { ArrowLeft, Plus } from "lucide-react-native";
import Animated from "react-native-reanimated";
import { styles } from "./styles";
import * as Haptics from "expo-haptics";

interface FilterHeaderProps {
  onBack: () => void;
  onCreateFilter: () => void;
  headerAnimatedStyle: any;
}

export const FilterHeader = React.memo<FilterHeaderProps>(
  ({ onBack, onCreateFilter, headerAnimatedStyle }) => {
    return (
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Filters</Text>
        <TouchableOpacity style={styles.addButton} onPress={onCreateFilter} activeOpacity={0.7}>
          <View style={styles.addButtonContainer}>
            <Plus size={22} color="#f8f9fa" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);
