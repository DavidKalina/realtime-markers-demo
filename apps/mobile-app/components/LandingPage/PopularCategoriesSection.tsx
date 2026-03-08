import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { useColors, fontSize, fontWeight, fontFamily, spacing, radius, type Colors } from "@/theme";
import { getCategoryColor } from "@/utils/categoryColors";
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

const titleCase = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

const PopularCategoriesSection: React.FC<PopularCategoriesSectionProps> = ({
  categories,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      <Text style={styles.title}>Categories</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {categories.map((item, index) => {
          const color = getCategoryColor(item.name);
          return (
            <Animated.View
              key={item.id}
              entering={FadeInRight.duration(200).delay(index * 50)}
            >
              <TouchableOpacity
                style={[
                  styles.pill,
                  {
                    backgroundColor: color + "12",
                    borderColor: color + "30",
                  },
                ]}
                onPress={() => handleCategoryPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.pillText, { color }]} numberOfLines={1}>
                  {titleCase(item.name)}
                </Text>
                {item.eventCount != null && (
                  <Text style={styles.pillCount}>{item.eventCount}</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing._6,
    paddingHorizontal: spacing._10 + 2,
    paddingVertical: spacing._6 + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
  },
  pillCount: {
    fontSize: 10,
    fontWeight: fontWeight.regular,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    marginLeft: 2,
  },
});

export default PopularCategoriesSection;
