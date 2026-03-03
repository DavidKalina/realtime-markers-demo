import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { apiClient } from "@/services/ApiClient";
import { eventBroker, EventTypes } from "@/services/EventBroker";

interface Category {
  id: string;
  name: string;
  icon: string;
  eventCount?: number;
}

export function useCategoryPreferences() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [includedCategoryIds, setIncludedCategoryIds] = useState<string[]>([]);
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories and current preferences on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [cats, prefs] = await Promise.all([
          apiClient.categories.getCategories(),
          apiClient.filters.getCategoryPreferences(),
        ]);

        if (cancelled) return;
        setCategories(cats);
        setIncludedCategoryIds(prefs.includeCategoryIds);
        setExcludedCategoryIds(prefs.excludeCategoryIds);
      } catch (error) {
        console.error("Error loading category preferences:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist to server and trigger viewport update (debounced)
  const syncPreferences = useCallback(
    (included: string[], excluded: string[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        try {
          await apiClient.filters.setCategoryPreferences(included, excluded);
          eventBroker.emit(EventTypes.FORCE_VIEWPORT_UPDATE, {
            timestamp: Date.now(),
            source: "useCategoryPreferences",
          });
        } catch (error) {
          console.error("Error saving category preferences:", error);
        }
      }, 300);
    },
    [],
  );

  const handleCategoryFilterChange = useCallback(
    (categoryId: string, mode: "include" | "exclude" | "none") => {
      Haptics.selectionAsync();

      setIncludedCategoryIds((prev) => {
        const next = prev
          .filter((id) => id !== categoryId)
          .concat(mode === "include" ? [categoryId] : []);

        setExcludedCategoryIds((prevExcluded) => {
          const nextExcluded = prevExcluded
            .filter((id) => id !== categoryId)
            .concat(mode === "exclude" ? [categoryId] : []);

          syncPreferences(next, nextExcluded);
          return nextExcluded;
        });

        return next;
      });
    },
    [syncPreferences],
  );

  const clearAllFilters = useCallback(() => {
    Haptics.selectionAsync();
    setIncludedCategoryIds([]);
    setExcludedCategoryIds([]);
    syncPreferences([], []);
  }, [syncPreferences]);

  const hasActiveFilters =
    includedCategoryIds.length > 0 || excludedCategoryIds.length > 0;
  const activeFilterCount =
    includedCategoryIds.length + excludedCategoryIds.length;

  return {
    categories,
    includedCategoryIds,
    excludedCategoryIds,
    isLoading,
    hasActiveFilters,
    activeFilterCount,
    handleCategoryFilterChange,
    clearAllFilters,
  };
}

export default useCategoryPreferences;
