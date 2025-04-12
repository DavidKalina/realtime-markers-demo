import { useFilterStore } from "@/stores/useFilterStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  ScrollView,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";
import { Filter as FilterType } from "../../services/ApiClient";
import Card from "../Layout/Card";
import Header from "../Layout/Header";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import { BottomActionBar } from "./BottomActionBar";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { FilterFormModal } from "./FilterFormModal";
import { FilterListItem } from "./FilterListItem";
import { LoadingState } from "./LoadingState";
import { styles } from "./styles";

const ACTIVE_FILTERS_KEY = "@active_filters";

const FiltersView: React.FC = () => {
  // Get state and actions from the store
  const {
    filters,
    isLoading,
    error,
    fetchFilters,
    createFilter,
    updateFilter,
    deleteFilter,
    applyFilters,
    clearFilters,
    activeFilterIds,
    setActiveFilterIds,
    isClearing,
  } = useFilterStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingFilter, setEditingFilter] = useState<FilterType | null>(null);
  const [filterName, setFilterName] = useState("");
  const [semanticQuery, setSemanticQuery] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [radius, setRadius] = useState<number>();
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);

  const scrollY = useSharedValue(0);
  const listRef = useAnimatedRef<FlatList>();
  const isMounted = useRef(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Add modal animation cleanup
  const modalAnimationProgress = useSharedValue(0);
  const modalContentAnimationProgress = useSharedValue(0);

  // Cleanup modal animations
  const cleanupModalAnimations = useCallback(() => {
    "worklet";
    if (!isMounted.current) return;
    modalAnimationProgress.value = 0;
    modalContentAnimationProgress.value = 0;
  }, []);



  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet";
      if (!isMounted.current) return;
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: () => {
      "worklet";
      if (!isMounted.current) return;
    },
    onMomentumEnd: () => {
      "worklet";
      if (!isMounted.current) return;
    },
  });

  // Comprehensive cleanup function for all animations
  const cleanupAllAnimations = useCallback(() => {
    if (!isMounted.current) return;

    // Clean up modal animations
    cleanupModalAnimations();

    // Clean up any other animations
    cancelAnimation(scrollY);
    scrollY.value = 0;

    // Reset any other animation values
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [cleanupModalAnimations, scrollY]);

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      cleanupAllAnimations();
    };
  }, [cleanupAllAnimations]);

  const router = useRouter();

  // Load active filters from storage on mount
  useEffect(() => {
    const loadActiveFilters = async () => {
      try {
        const storedFilters = await AsyncStorage.getItem(ACTIVE_FILTERS_KEY);
        if (storedFilters) {
          const activeIds = JSON.parse(storedFilters);
          setActiveFilterIds(activeIds);
        }
      } catch (err) {
        console.error("Error loading active filters:", err);
      }
    };

    loadActiveFilters();
  }, []);

  // Save active filters to storage whenever they change
  useEffect(() => {
    const saveActiveFilters = async () => {
      try {
        if (activeFilterIds.length > 0) {
          await AsyncStorage.setItem(ACTIVE_FILTERS_KEY, JSON.stringify(activeFilterIds));
        } else {
          await AsyncStorage.removeItem(ACTIVE_FILTERS_KEY);
        }
      } catch (err) {
        console.error("Error saving active filters:", err);
      }
    };

    saveActiveFilters();
  }, [activeFilterIds]);

  // Fetch all filters when component mounts
  useEffect(() => {
    fetchFilters();
  }, []);

  // Enhanced back button handler with proper cleanup
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cleanupAllAnimations();
    Promise.resolve().then(() => {
      if (isMounted.current) {
        router.back();
      }
    });
  }, [cleanupAllAnimations, router]);

  // Open modal to create a new filter
  const handleCreateFilter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Reset form fields
    setEditingFilter(null);
    setFilterName("");
    setSemanticQuery("");
    setIsActive(true);
    setStartDate("");
    setEndDate("");
    setRadius(undefined);
    setLocation(null);
    setIsLocationEnabled(false);
    setModalVisible(true);
  };

  // Open modal to edit an existing filter
  const handleEditFilter = (filter: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingFilter(filter);
    setFilterName(filter.name);
    setSemanticQuery(filter.semanticQuery || "");
    setIsActive(activeFilterIds.includes(filter.id));
    setStartDate(filter.criteria.dateRange?.start || "");
    setEndDate(filter.criteria.dateRange?.end || "");
    setIsLocationEnabled(!!filter.criteria.location);
    setRadius(
      filter.criteria.location?.radius ? filter.criteria.location.radius / 1000 : undefined
    );
    setLocation(
      filter.criteria.location?.latitude !== undefined &&
        filter.criteria.location?.longitude !== undefined
        ? {
          latitude: filter.criteria.location.latitude,
          longitude: filter.criteria.location.longitude,
        }
        : null
    );
    setModalVisible(true);
  };

  // Delete a filter
  const handleDeleteFilter = (filterId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Delete Filter", "Are you sure you want to delete this filter?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFilter(filterId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) {
            console.error("Error deleting filter:", err);
            Alert.alert("Error", "Failed to delete filter");
          }
        },
      },
    ]);
  };

  // Apply a filter
  const handleApplyFilter = async (filter: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await applyFilters([filter.id]);
      router.back();
    } catch (err) {
      console.error("Error applying filter:", err);
      Alert.alert("Error", "Failed to apply filter");
    }
  };

  // Enhanced clear filters handler with proper cleanup
  const handleClearFilters = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cleanupAllAnimations();
    try {
      await clearFilters();
      router.back();
    } catch (err) {
      console.error("Error clearing filters:", err);
      Alert.alert("Error", "Failed to clear filters");
    }
  }, [cleanupAllAnimations, clearFilters, router]);

  // Dismiss the keyboard
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Enhanced modal close handler
  const handleCloseModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cleanupAllAnimations();
    setModalVisible(false);
    setEditingFilter(null);
    setFilterName("");
    setSemanticQuery("");
    setIsActive(true);
    setStartDate("");
    setEndDate("");
    setRadius(undefined);
    setLocation(null);
    setIsLocationEnabled(false);
  }, [cleanupAllAnimations]);

  // Enhanced save filter handler with proper cleanup
  const handleSaveFilter = useCallback(async () => {
    if (!filterName.trim()) {
      Alert.alert("Error", "Filter name is required");
      return;
    }

    // Check if this is the first filter
    const isFirstFilter = filters.length === 0;

    if (isFirstFilter) {
      if (!startDate || !endDate) {
        Alert.alert("Error", "Date range is required for the first filter");
        return;
      }
    } else {
      if (!semanticQuery.trim()) {
        Alert.alert("Error", "Search query is required");
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const filterData: Partial<FilterType> = {
      name: filterName.trim(),
      semanticQuery: semanticQuery.trim(),
      criteria: {
        // Preserve existing criteria if editing
        ...(editingFilter?.criteria || {}),
        // Update date range if provided
        ...(startDate && endDate
          ? {
            dateRange: {
              start: startDate,
              end: endDate,
            },
          }
          : {}),
        // Update location if enabled
        ...(isLocationEnabled && location && radius
          ? {
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
              radius: radius * 1000,
            },
          }
          : {}),
      },
    };

    try {
      let savedFilter;
      if (editingFilter) {
        savedFilter = await updateFilter(editingFilter.id, filterData);
      } else {
        savedFilter = await createFilter(filterData);
      }

      if (isActive) {
        await applyFilters([savedFilter.id]);
      }

      // Clean up animations before closing modal
      cleanupAllAnimations();
      setModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Error saving filter:", err);
      Alert.alert("Error", "Failed to save filter");
    }
  }, [
    cleanupAllAnimations,
    filterName,
    semanticQuery,
    startDate,
    endDate,
    isLocationEnabled,
    location,
    radius,
    editingFilter,
    isActive,
    updateFilter,
    createFilter,
    applyFilters,
    filters,
  ]);

  return (
    <ScreenLayout>
      <Header
        title="Filters"
        onBack={handleBack}
        rightIcon={
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleCreateFilter}
            activeOpacity={0.7}
          >
            <Plus size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.contentArea}>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={fetchFilters} />
        ) : filters.length === 0 ? (
          <EmptyState onCreateFilter={handleCreateFilter} />
        ) : (
          <Animated.FlatList
            ref={listRef}
            data={filters}
            renderItem={({ index, item }) => (
              <Card delay={index * 100}>
                <FilterListItem
                  item={item}
                  activeFilterIds={activeFilterIds}
                  onApply={handleApplyFilter}
                  onEdit={handleEditFilter}
                  onDelete={handleDeleteFilter}
                />
              </Card>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          />
        )}
      </View>

      {filters.length > 0 && <BottomActionBar onClearFilters={handleClearFilters} isClearing={isClearing} />}

      <FilterFormModal
        visible={modalVisible}
        editingFilter={editingFilter}
        filterName={filterName}
        semanticQuery={semanticQuery}
        isActive={isActive}
        startDate={startDate}
        endDate={endDate}
        radius={radius}
        isLocationEnabled={isLocationEnabled}
        onClose={handleCloseModal}
        onSave={handleSaveFilter}
        onDismissKeyboard={dismissKeyboard}
        setFilterName={setFilterName}
        setSemanticQuery={setSemanticQuery}
        setIsActive={setIsActive}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        setRadius={setRadius}
        setIsLocationEnabled={setIsLocationEnabled}
        setLocation={setLocation}
        isMounted={isMounted}
        cleanupModalAnimations={cleanupModalAnimations}
      />
    </ScreenLayout>
  );
};

export default FiltersView;
