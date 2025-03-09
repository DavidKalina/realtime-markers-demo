import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Filter, Search, Plus, Grid, Tag, Check } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import apiClient from "../../services/ApiClient";
import { styles } from "./styles";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CategoriesScreenProps {
  onBack?: () => void;
  onSelectCategory?: (category: Category) => void;
  onSelectCategories?: (categories: Category[]) => void;
  selectionMode?: boolean;
  multiSelect?: boolean;
  maxSelections?: number;
}

const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  onBack,
  onSelectCategory,
  onSelectCategories,
  selectionMode = false,
  multiSelect = false,
  maxSelections = 0,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCategoryObjects, setSelectedCategoryObjects] = useState<Category[]>([]);
  const router = useRouter();

  // Define dummy data outside the effect to prevent recreating it on every render
  const dummyCategories = [
    {
      id: "9fa1ace2-e644-4e77-aa68-d47703eaca1a",
      name: "2000s",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:42:56.126Z",
      updatedAt: "2025-03-09T22:42:56.126Z",
    },
    {
      id: "11c49b2e-65f8-4da3-ad15-8093d4cf4def",
      name: "career",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:05:49.951Z",
      updatedAt: "2025-03-09T22:05:49.951Z",
    },
    {
      id: "df793fb2-5321-4c29-8afb-a6c13892b691",
      name: "career development",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:16:35.990Z",
      updatedAt: "2025-03-09T22:16:35.990Z",
    },
    {
      id: "68ad4682-294b-48b7-888f-a961ee2ac9a5",
      name: "dance",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:04:42.599Z",
      updatedAt: "2025-03-09T22:04:42.599Z",
    },
    {
      id: "90d794a8-e336-407f-aafe-38023fd1c4c6",
      name: "education",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:05:49.951Z",
      updatedAt: "2025-03-09T22:05:49.951Z",
    },
    {
      id: "be863167-f8a4-40ab-b1d4-666c5d24d166",
      name: "entertainment",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:42:56.126Z",
      updatedAt: "2025-03-09T22:42:56.126Z",
    },
    {
      id: "d809815a-1156-4207-8f66-81afcab0b766",
      name: "food",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:05:49.951Z",
      updatedAt: "2025-03-09T22:05:49.951Z",
    },
    {
      id: "ed0d6879-df89-40f6-b9b0-da994361454d",
      name: "music",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:04:42.599Z",
      updatedAt: "2025-03-09T22:04:42.599Z",
    },
    {
      id: "d06fe7d3-c877-41c6-98c1-b8a80c2d287a",
      name: "networking",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:05:49.951Z",
      updatedAt: "2025-03-09T22:05:49.951Z",
    },
    {
      id: "ba711d79-86d0-4211-8254-5a01fa6aa738",
      name: "party",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:20:07.540Z",
      updatedAt: "2025-03-09T22:20:07.540Z",
    },
    {
      id: "06b184db-f334-447c-b1a9-cabc27962539",
      name: "social",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:04:42.599Z",
      updatedAt: "2025-03-09T22:04:42.599Z",
    },
    {
      id: "f4b42817-9d7f-47c4-ab8a-c17a72ee87a9",
      name: "workshop",
      description: null,
      icon: null,
      createdAt: "2025-03-09T22:05:49.951Z",
      updatedAt: "2025-03-09T22:05:49.951Z",
    },
  ];

  // Fetch categories when component mounts
  useEffect(() => {
    let isMounted = true;

    const fetchCategories = async () => {
      if (!isMounted) return;

      setLoading(true);
      setError(null);

      try {
        // For now, using dummy data - in a real implementation, you would use:
        // const categoriesData = await apiClient.getCategories();

        // Using the pre-defined dummy data
        const categoriesData = [...dummyCategories];

        if (isMounted) {
          // Sort categories alphabetically by name
          const sortedCategories = categoriesData.sort((a, b) => a.name.localeCompare(b.name));
          setCategories(sortedCategories);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            `Failed to load categories: ${err instanceof Error ? err.message : "Unknown error"}`
          );
          console.error("Error fetching categories:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Handle category selection
  const handleCategoryPress = (category: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Always toggle selection state in multi-select mode
    setSelectedCategories((prev) => {
      if (prev.includes(category.id)) {
        // Remove from selection
        const newSelectedIds = prev.filter((id) => id !== category.id);

        // Update selected category objects
        setSelectedCategoryObjects((current) => current.filter((cat) => cat.id !== category.id));

        return newSelectedIds;
      } else {
        // Check if we've hit max selections
        if (maxSelections > 0 && prev.length >= maxSelections) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            "Maximum Selections",
            `You can only select up to ${maxSelections} categories.`
          );
          return prev;
        }

        // Add to selection
        const newSelectedIds = [...prev, category.id];

        // Update selected category objects
        setSelectedCategoryObjects((current) => [...current, category]);

        return newSelectedIds;
      }
    });

    // If in single selection mode and a callback is provided, also notify the parent
    if (!multiSelect && onSelectCategory) {
      onSelectCategory(category);
    }
  };

  // Handle retry when error occurs
  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);

    // Re-fetch categories
    // This would use the actual API in a real implementation
    setTimeout(() => {
      // Simulate API call with dummy data
      const sortedCategories = [...dummyCategories].sort((a, b) => a.name.localeCompare(b.name));
      setCategories(sortedCategories);
      setLoading(false);
    }, 1000);
  };

  // Handle creating a new category
  const handleCreateCategory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to create category screen (if implemented)
    // router.push("/create-category");

    // For now, just show an alert
    Alert.alert("Create Category", "This would open the create category screen");
  };

  // Handle confirming multiple selections
  const handleConfirmSelections = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (selectedCategories.length === 0) {
      Alert.alert("No Selection", "Please select at least one category");
      return;
    }

    if (onSelectCategories) {
      // We already maintain the selected category objects internally
      onSelectCategories(selectedCategoryObjects);
    } else {
      // For testing purposes
      Alert.alert(
        "Categories Selected",
        `You selected ${selectedCategories.length} categories:\n${selectedCategoryObjects
          .map((cat) => cat.name)
          .join(", ")}`
      );
    }
  };

  // Get an icon for a category (placeholder functionality) - memoized
  const getCategoryIcon = useCallback((category: Category) => {
    // If the category has an icon, use it
    if (category.icon) {
      return category.icon;
    }

    // Otherwise, assign an emoji based on the category name
    const categoryNameLower = category.name.toLowerCase();

    if (categoryNameLower.includes("music")) return "🎵";
    if (categoryNameLower.includes("food")) return "🍽️";
    if (categoryNameLower.includes("dance")) return "💃";
    if (categoryNameLower.includes("party")) return "🎉";
    if (categoryNameLower.includes("education") || categoryNameLower.includes("class")) return "📚";
    if (categoryNameLower.includes("career")) return "💼";
    if (categoryNameLower.includes("social")) return "👥";
    if (categoryNameLower.includes("workshop")) return "🛠️";
    if (categoryNameLower.includes("entertainment")) return "🎭";
    if (categoryNameLower.includes("networking")) return "🔄";

    // Default icon
    return "🏷️";
  }, []);

  // Render a category item - memoized to prevent unnecessary rerenders
  const renderCategoryItem = useCallback(
    ({ item }: { item: Category }) => {
      const isSelected = selectedCategories.includes(item.id);

      return (
        <TouchableOpacity
          style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
          onPress={() => handleCategoryPress(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.categoryEmoji}>{getCategoryIcon(item)}</Text>
          <View style={styles.categoryTextContainer}>
            <Text style={styles.categoryName}>{item.name}</Text>
            {item.description && (
              <Text style={styles.categoryDescription} numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>
          {(multiSelect || selectionMode) && (
            <View style={[styles.checkboxContainer, isSelected && styles.checkboxSelected]}>
              {isSelected && <Check size={16} color="#ffffff" />}
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedCategories, multiSelect, selectionMode]
  );

  // Get selected count text
  const getSelectionCountText = () => {
    const count = selectedCategories.length;
    if (count === 0) return "No categories selected";
    if (count === 1) return "1 category selected";
    return `${count} categories selected`;
  };

  // To clear all selections
  const clearSelections = () => {
    setSelectedCategories([]);
    setSelectedCategoryObjects([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{multiSelect ? "Select Categories" : "Categories"}</Text>

        {/* Action buttons in header */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Search size={20} color="#93c5fd" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Filter size={20} color="#93c5fd" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : categories.length === 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No categories available</Text>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.categoriesContainer}>
            {/* Header info section */}
            <View style={styles.infoHeaderContainer}>
              <View style={styles.infoHeaderIconContainer}>
                <Tag size={22} color="#93c5fd" />
              </View>
              <View style={styles.infoHeaderTextContainer}>
                <Text style={styles.infoHeaderTitle}>
                  {multiSelect ? "Select Multiple Categories" : "Event Categories"}
                </Text>
                <Text style={styles.infoHeaderDescription}>
                  {multiSelect
                    ? maxSelections > 0
                      ? `Select up to ${maxSelections} categories`
                      : "Select multiple categories for your event"
                    : "Browse or select categories for your events"}
                </Text>
              </View>
            </View>

            {/* Categories list */}
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.categoryListContent}
              showsVerticalScrollIndicator={false}
              numColumns={1}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={10}
            />
          </Animated.View>
        )}
      </View>

      {/* Selection footer for multi-select mode */}
      {(multiSelect || selectionMode) && !loading && !error && categories.length > 0 && (
        <View style={styles.selectionFooter}>
          <View style={styles.selectionFooterLeft}>
            <Text style={styles.selectionCount}>{getSelectionCountText()}</Text>
            {selectedCategories.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={clearSelections}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              selectedCategories.length === 0 && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirmSelections}
            disabled={selectedCategories.length === 0}
          >
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

// Merge extended styles with your existing styles
// In your actual code, update your styles.ts file with these additions

export default CategoriesScreen;
