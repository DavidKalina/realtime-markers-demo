import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  ScrollView,
} from "react-native";
import { Tag, X, Plus } from "lucide-react-native";
import { Select, SelectOption } from "../Select/Select";
import { COLORS } from "../Layout/ScreenLayout";
import * as Haptics from "expo-haptics";

export interface Category {
  id: string;
  name: string;
}

interface CategorySelectorProps {
  selectedCategories: Category[];
  availableCategories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
  onSearchCategories?: (query: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  maxCategories?: number;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategories,
  availableCategories,
  onCategoriesChange,
  onSearchCategories,
  isLoading = false,
  error,
  maxCategories = 5,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleSelectCategory = useCallback(
    (option: SelectOption) => {
      Haptics.selectionAsync();
      const category = availableCategories.find((c) => c.id === option.id);
      if (!category) return;

      // Check if category is already selected
      if (selectedCategories.some((c) => c.id === category.id)) {
        return;
      }

      // Check if we've reached the maximum number of categories
      if (selectedCategories.length >= maxCategories) {
        return;
      }

      onCategoriesChange([...selectedCategories, category]);
      setSearchQuery("");
    },
    [
      selectedCategories,
      availableCategories,
      maxCategories,
      onCategoriesChange,
    ],
  );

  const handleRemoveCategory = useCallback(
    (categoryId: string) => {
      Haptics.selectionAsync();
      onCategoriesChange(
        selectedCategories.filter((category) => category.id !== categoryId),
      );
    },
    [selectedCategories, onCategoriesChange],
  );

  const handleAddNewCategory = useCallback(() => {
    if (!newCategoryInput.trim()) return;

    const newCategory: Category = {
      id: `new-${Date.now()}`,
      name: newCategoryInput.trim(),
    };

    onCategoriesChange([...selectedCategories, newCategory]);
    setNewCategoryInput("");
    setIsAddingNew(false);
    Keyboard.dismiss();
  }, [newCategoryInput, selectedCategories, onCategoriesChange]);

  const filteredOptions: SelectOption[] = availableCategories
    .filter(
      (category) =>
        !selectedCategories.some((c) => c.id === category.id) &&
        category.name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .map((category) => ({
      id: category.id,
      label: category.name,
    }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Tag size={18} color={COLORS.accent} />
        <Text style={styles.title}>Categories</Text>
        {selectedCategories.length > 0 && (
          <Text style={styles.count}>({selectedCategories.length})</Text>
        )}
      </View>

      {/* Selected Categories */}
      {selectedCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.selectedCategoriesContainer}
          contentContainerStyle={styles.selectedCategoriesContent}
        >
          {selectedCategories.map((category) => (
            <View key={category.id} style={styles.categoryTag}>
              <Text style={styles.categoryText}>{category.name}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveCategory(category.id)}
                style={styles.removeButton}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <X size={14} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Category Selection */}
      {selectedCategories.length < maxCategories && (
        <View style={styles.selectionContainer}>
          {isAddingNew ? (
            <View style={styles.newCategoryInputContainer}>
              <TextInput
                style={styles.newCategoryInput}
                value={newCategoryInput}
                onChangeText={setNewCategoryInput}
                placeholder="Enter new category..."
                placeholderTextColor={COLORS.textSecondary}
                autoFocus
                onSubmitEditing={handleAddNewCategory}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => setIsAddingNew(false)}
                style={styles.cancelButton}
              >
                <X size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Select
                value={undefined}
                options={filteredOptions}
                placeholder="Search categories..."
                searchable
                loading={isLoading}
                onSearch={onSearchCategories}
                onChange={handleSelectCategory}
                style={styles.select}
              />
              <TouchableOpacity
                onPress={() => setIsAddingNew(true)}
                style={styles.addNewButton}
                activeOpacity={0.7}
              >
                <Plus size={18} color={COLORS.accent} />
                <Text style={styles.addNewText}>Add New</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
      {selectedCategories.length >= maxCategories && (
        <Text style={styles.maxCategoriesText}>
          Maximum {maxCategories} categories allowed
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginLeft: 8,
  },
  count: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  selectedCategoriesContainer: {
    maxHeight: 40,
    marginBottom: 12,
  },
  selectedCategoriesContent: {
    gap: 8,
    paddingRight: 20,
  },
  categoryTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },
  categoryText: {
    fontSize: 13,
    color: COLORS.accent,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    letterSpacing: 0.3,
    marginRight: 4,
  },
  removeButton: {
    padding: 2,
  },
  selectionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  select: {
    flex: 1,
  },
  addNewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },
  addNewText: {
    color: COLORS.accent,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginLeft: 4,
  },
  newCategoryInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    paddingHorizontal: 12,
    height: 55,
  },
  newCategoryInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    paddingVertical: 8,
  },
  cancelButton: {
    padding: 4,
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginTop: 4,
  },
  maxCategoriesText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginTop: 4,
  },
});
