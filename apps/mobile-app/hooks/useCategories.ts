import { useState, useCallback, useEffect, useRef } from "react";
import { Category } from "@/services/api/base/types";
import { apiClient } from "@/services/ApiClient";

interface UseCategoriesOptions {
  maxCategories?: number;
  initialCategories?: Category[];
}

interface UseCategoriesReturn {
  selectedCategories: Category[];
  availableCategories: Category[];
  isLoading: boolean;
  error: string | null;
  handleSearchCategories: (query: string) => Promise<void>;
  handleCategoriesChange: (categories: Category[]) => void;
  handleAddCategory: (category: Category) => void;
  handleRemoveCategory: (categoryId: string) => void;
  resetCategories: () => void;
}

export const useCategories = ({
  maxCategories = 5,
  initialCategories = [],
}: UseCategoriesOptions = {}): UseCategoriesReturn => {
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Load initial categories and set them only once on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const categories = await apiClient.categories.getAllCategories();

        // Merge available categories with initial categories to ensure we have all needed categories
        const allCategories = [...categories];
        initialCategories.forEach((initialCat) => {
          if (!allCategories.some((cat) => cat.id === initialCat.id)) {
            allCategories.push(initialCat);
          }
        });

        setAvailableCategories(allCategories);

        // Only set selected categories from initialCategories on first mount
        if (!hasInitializedRef.current) {
          setSelectedCategories(initialCategories);
          hasInitializedRef.current = true;
        }
      } catch (error) {
        console.error("Error loading categories:", error);
        setError("Failed to load categories. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []); // Empty dependency array since we only want to run this once

  const handleSearchCategories = useCallback(async (query: string) => {
    try {
      setIsLoading(true);
      const categories = await apiClient.categories.searchCategories(query);
      setAvailableCategories(categories);
      setError(null);
    } catch (error) {
      console.error("Error searching categories:", error);
      setError("Failed to search categories. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCategoriesChange = useCallback(
    (categories: Category[]) => {
      if (categories.length > maxCategories) {
        setError(`Maximum ${maxCategories} categories allowed`);
        return;
      }
      setSelectedCategories(categories);
      setError(null);
    },
    [maxCategories],
  );

  const handleAddCategory = useCallback(
    (category: Category) => {
      if (selectedCategories.length >= maxCategories) {
        setError(`Maximum ${maxCategories} categories allowed`);
        return;
      }
      if (selectedCategories.some((c) => c.id === category.id)) {
        return; // Category already selected
      }
      setSelectedCategories((prev) => [...prev, category]);
      setError(null);
    },
    [selectedCategories, maxCategories],
  );

  const handleRemoveCategory = useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.filter((category) => category.id !== categoryId),
    );
    setError(null);
  }, []);

  const resetCategories = useCallback(() => {
    setSelectedCategories([]);
    setError(null);
  }, []);

  return {
    selectedCategories,
    availableCategories,
    isLoading,
    error,
    handleSearchCategories,
    handleCategoriesChange,
    handleAddCategory,
    handleRemoveCategory,
    resetCategories,
  };
};
