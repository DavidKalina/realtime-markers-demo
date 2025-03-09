import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Filter, Search, X, Tag, Check } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { styles } from "./styles";
import { Category, useCategories } from "@/hooks/useCategories";

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCategoryObjects, setSelectedCategoryObjects] = useState<Category[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const router = useRouter();

  // Use our custom hook with a reasonable page size
  const {
    categories,
    loading,
    error,
    hasMore,
    loadMore,
    search,
    searchQuery,
    refreshing,
    refresh,
    clearSearch,
  } = useCategories({ initialPageSize: 15, searchDebounceTime: 300 });

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
    refresh();
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

  // Toggle search bar
  const handleToggleSearch = () => {
    setShowSearch((prev) => !prev);
    if (showSearch) {
      // Clear search when hiding search bar
      setSearchText("");
      clearSearch();
    }
  };

  // Handle search input
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    search(text);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchText("");
    clearSearch();
  };

  // Get an icon for a category (placeholder functionality)
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

  // Render a category item
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

  // Handle end reached (for infinite scroll)
  const handleEndReached = () => {
    if (!loading && hasMore) {
      loadMore();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>

        {showSearch ? (
          <View style={styles.searchInputContainer}>
            <Search size={18} color="#93c5fd" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search categories..."
              placeholderTextColor="#adb5bd"
              value={searchText}
              onChangeText={handleSearchChange}
              autoFocus
              selectTextOnFocus
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity style={styles.clearSearchButton} onPress={handleClearSearch}>
                <X size={18} color="#adb5bd" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={styles.headerTitle}>{multiSelect ? "Select Categories" : "Categories"}</Text>
        )}

        {/* Action buttons in header */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton} onPress={handleToggleSearch}>
            {showSearch ? <X size={20} color="#93c5fd" /> : <Search size={20} color="#93c5fd" />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Filter size={20} color="#93c5fd" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {loading && categories.length === 0 ? (
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
            <Text style={styles.noResultsText}>
              {searchText
                ? `No categories found matching "${searchText}"`
                : "No categories available"}
            </Text>
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
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.3}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  colors={["#93c5fd"]}
                  tintColor="#93c5fd"
                />
              }
              ListFooterComponent={
                loading && categories.length > 0 ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color="#93c5fd" />
                    <Text style={styles.footerLoaderText}>Loading more...</Text>
                  </View>
                ) : null
              }
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

export default CategoriesScreen;
