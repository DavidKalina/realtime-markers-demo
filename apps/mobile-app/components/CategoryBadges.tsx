import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

const CategoryBadges = ({
  categories = [],
  selectedCategories = [],
  onToggleCategory,
  containerStyle = {},
}: any) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scrollContainer, containerStyle]}
      contentContainerStyle={styles.scrollContentContainer}
    >
      {categories?.map((category: any) => (
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    maxHeight: 80, // Fixed height for the scroll container
  },
  scrollContentContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 8, // Space between badges
  },
  badge: {
    paddingVertical: 4, // Reduced vertical padding
    paddingHorizontal: 8,
    backgroundColor: "#444",
    borderRadius: 12,
    borderWidth: 0,
  },
  selectedBadge: {
    backgroundColor: "#69db7c",
  },
  badgeText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  selectedBadgeText: {
    color: "#000",
    fontWeight: "bold",
  },
});

export default CategoryBadges;
