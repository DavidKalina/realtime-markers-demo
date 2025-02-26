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
            numberOfLines={1}
            ellipsizeMode="tail"
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
    maxHeight: 48, // Reduced from 80 to prevent excessive vertical space
  },
  scrollContentContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10, // Increased from 8 to give more breathing room
  },
  badge: {
    paddingVertical: 6, // Increased from 4 for better touch targets
    paddingHorizontal: 12, // Increased from 8 to prevent text cramping
    backgroundColor: "#444",
    borderRadius: 16, // Increased from 12 for a more modern look
    borderWidth: 0,
    minWidth: 40, // Ensure badges have minimum width
    alignItems: "center", // Center the text horizontally
  },
  selectedBadge: {
    backgroundColor: "#69db7c",
  },
  badgeText: {
    color: "#FFF",
    fontSize: 13, // Slightly increased from 12 for better readability
    fontFamily: "SpaceMono",
  },
  selectedBadgeText: {
    color: "#000",
    fontWeight: "bold",
  },
});

export default CategoryBadges;
