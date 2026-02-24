import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
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
  eventCount?: number;
}

interface PopularCategoriesSectionProps {
  categories: Category[];
  isLoading?: boolean;
}

const CARD_WIDTH = 160;

const titleCase = (str: string) =>
  str.replace(/\b\w/g, (c) => c.toUpperCase());

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

  const renderItem = ({ item, index }: { item: Category; index: number }) => (
    <Animated.View entering={FadeInRight.duration(300).delay(index * 80)}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleCategoryPress(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.categoryName} numberOfLines={2}>
          {titleCase(item.name)}
        </Text>
        {item.eventCount != null && (
          <Text style={styles.eventCount}>
            {item.eventCount} {item.eventCount === 1 ? "event" : "events"}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Popular Categories</Text>
      <FlatList
        data={categories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
      />
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
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    textAlign: "center",
    lineHeight: fontSize.md * 1.4,
  },
  eventCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    marginTop: spacing.sm,
  },
});

export default PopularCategoriesSection;
