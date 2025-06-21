import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
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
      <View style={{ marginBottom: 24 }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "600",
            marginBottom: 12,
            paddingHorizontal: 16,
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
                { backgroundColor: "#f0f0f0", opacity: 0.6 },
              ]}
            >
              <View
                style={[styles.iconContainer, { backgroundColor: "#e0e0e0" }]}
              />
              <View
                style={{
                  height: 12,
                  backgroundColor: "#e0e0e0",
                  borderRadius: 6,
                  marginTop: 8,
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
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "600",
          marginBottom: 12,
          paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryItem: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  iconText: {
    fontSize: 20,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    color: "#333",
  },
});

export default PopularCategoriesSection;
