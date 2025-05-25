import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Tag } from "lucide-react-native";
import SectionHeader from "@/components/Layout/SectionHeader";
import { COLORS } from "@/components/Layout/ScreenLayout";

interface Category {
  id: string;
  name: string;
}

interface GroupCategoriesSectionProps {
  categories?: Category[];
}

export const GroupCategoriesSection: React.FC<GroupCategoriesSectionProps> = ({
  categories = [],
}) => {
  if (!categories || categories.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader icon={Tag} title="Categories" />
      <View style={styles.categoriesContainer}>
        {categories.map((category) => (
          <View key={category.id} style={styles.categoryTag}>
            <Text style={styles.categoryText}>{category.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  categoriesContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryTag: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  categoryText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    letterSpacing: 0.2,
  },
});
