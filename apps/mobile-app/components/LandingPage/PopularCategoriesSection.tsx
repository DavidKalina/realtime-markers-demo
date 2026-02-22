import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface PopularCategoriesSectionProps {
  categories: Category[];
  isLoading?: boolean;
}

const PopularCategoriesSection: React.FC<PopularCategoriesSectionProps> = ({
  categories,
}) => {
  const router = useRouter();

  const handleCategoryPress = (category: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/category/[id]" as const,
      params: { id: category.id },
    });
  };

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Popular Categories</Text>
      <View style={styles.gridContainer}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryItem}
            onPress={() => handleCategoryPress(category)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>
                {category.icon || "📌"}
              </Text>
            </View>
            <Text style={styles.categoryName} numberOfLines={2}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing["2xl"],
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  categoryItem: {
    width: "30%",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent.muted,
    borderWidth: 1,
    borderColor: colors.accent.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  iconText: {
    fontSize: fontSize.xl,
  },
  categoryName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: "center",
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

export default PopularCategoriesSection;
