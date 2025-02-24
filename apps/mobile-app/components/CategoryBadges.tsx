import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

const CategoryBadges = ({
  categories = [],
  selectedCategories = [],
  onToggleCategory,
  containerStyle = {},
}: any) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {categories.map((category: any) => (
        <TouchableOpacity
          key={category.id}
          style={[styles.badge, selectedCategories.includes(category.id) && styles.selectedBadge]}
          onPress={() => onToggleCategory(category.id)}
        >
          <Text
            style={[
              styles.badgeText,
              selectedCategories.includes(category.id) && styles.selectedBadgeText,
            ]}
          >
            {category.emoji} {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = {
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8, // Space between badges
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedBadge: {
    backgroundColor: "#007AFF",
    borderColor: "#0057B8",
  },
  badgeText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },
  selectedBadgeText: {
    color: "#fff",
  },
};

export default CategoryBadges;
