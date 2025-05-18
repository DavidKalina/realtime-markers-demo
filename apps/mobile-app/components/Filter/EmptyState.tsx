import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Plus, Sliders } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { styles } from "./styles";

interface EmptyStateProps {
  onCreateFilter: () => void;
}

export const EmptyState = React.memo<EmptyStateProps>(({ onCreateFilter }) => {
  return (
    <Animated.View
      style={styles.emptyStateContainer}
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition.springify()}
    >
      <View style={styles.emptyStateIconContainer}>
        <Sliders size={40} color="#93c5fd" />
      </View>
      <Text style={styles.emptyStateTitle}>No filters found</Text>
      <Text style={styles.emptyStateDescription}>
        Create smart filters to find events using natural language search.
      </Text>
      <TouchableOpacity
        style={styles.createFilterButton}
        onPress={onCreateFilter}
        activeOpacity={0.8}
      >
        <View style={styles.buttonContent}>
          <Plus size={18} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.createFilterText}>Create Filter</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});
