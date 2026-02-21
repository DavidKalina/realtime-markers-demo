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
  isLoading = false,
}) => {
  const router = useRouter();

  const handleCategoryPress = (category: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/category/[id]" as const,
      params: { id: category.id },
    });
  };

  if (isLoading) {
    return (
      <View style={{ marginBottom: spacing["2xl"] }}>
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.semibold,
            marginBottom: spacing.md,
            paddingHorizontal: spacing.lg,
            fontFamily: fontFamily.mono,
          }}
        >
          Popular Categories
        </Text>
        <View style={styles.gridContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View
              key={i}
              style={[
                styles.categoryItem,
                {
                  backgroundColor: "#f0f0f0",
                  opacity: 0.6,
                  shadowOpacity: 0,
                  elevation: 0,
                },
              ]}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: "#e0e0e0",
                    shadowOpacity: 0,
                    elevation: 0,
                  },
                ]}
              />
              <View
                style={{
                  height: 12,
                  backgroundColor: "#e0e0e0",
                  borderRadius: 6,
                  marginTop: spacing.sm,
                  width: "60%",
                }}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: spacing["2xl"] }}>
      <Text
        style={{
          fontSize: fontSize.xl,
          fontWeight: fontWeight.semibold,
          marginBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          fontFamily: fontFamily.mono,
        }}
      >
        Popular Categories
      </Text>
      <View style={styles.gridContainer}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryItem}
            onPress={() => handleCategoryPress(category)}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>{category.icon}</Text>
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
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  categoryItem: {
    width: "30%",
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.fixed.white,
    shadowColor: colors.fixed.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing._10,
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  iconText: {
    fontSize: fontSize.xl,
  },
  categoryName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: "center",
    color: colors.bg.elevated,
    fontFamily: fontFamily.mono,
  },
});

export default PopularCategoriesSection;
