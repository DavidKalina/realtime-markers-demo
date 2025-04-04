import { useFilterStore } from "@/stores/useFilterStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Edit2,
  Filter as FilterIcon,
  Plus,
  Save,
  SearchIcon,
  Sliders,
  Trash2,
  X,
  MapPin,
  Check,
} from "lucide-react-native";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
  TextStyle,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  ZoomIn,
  ZoomOut,
  withSpring,
  withTiming,
  SlideInDown,
  SlideOutDown,
  Layout,
  cancelAnimation,
} from "react-native-reanimated";
import { Filter as FilterType } from "../../services/ApiClient";
import * as Location from "expo-location";
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

  // Animation for header shadow
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      scrollY.value,
      [0, 50],
      [0, 0.15],
      'clamp'
    );

    const borderOpacity = interpolate(
      scrollY.value,
      [0, 50],
      [0, 0.1],
      'clamp'
    );

    return {
      shadowOpacity,
      borderBottomColor: `rgba(58, 58, 58, ${borderOpacity})`,
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, 50],
            [0, -2],
            'clamp'
          )
        }
      ]
    } as ViewStyle;
  });

  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      if (!isMounted.current) return;
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: () => {
      'worklet';
      if (!isMounted.current) return;
    },
    onMomentumEnd: () => {
      'worklet';
      if (!isMounted.current) return;
    }
  });

  // Cleanup function for animations
  const cleanupAnimations = useCallback(() => {
    'worklet';
    if (!isMounted.current) return;
    cancelAnimation(scrollY);
    scrollY.value = 0;
  }, [scrollY]);

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      cleanupAnimations();
    };
  }, [cleanupAnimations]);

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

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

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
    setRadius(filter.criteria.location?.radius ? filter.criteria.location.radius / 1000 : undefined);
    setLocation(
      filter.criteria.location?.latitude !== undefined &&
        filter.criteria.location?.longitude !== undefined
        ? {
          latitude: filter.criteria.location.latitude,
          longitude: filter.criteria.location.longitude
        }
        : null
    );
    setModalVisible(true);
  };

  // Dismiss the keyboard
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Add modal animation cleanup
  const modalAnimationProgress = useSharedValue(0);
  const modalContentAnimationProgress = useSharedValue(0);

  // Cleanup modal animations
  const cleanupModalAnimations = useCallback(() => {
    'worklet';
    if (!isMounted.current) return;
    modalAnimationProgress.value = 0;
    modalContentAnimationProgress.value = 0;
  }, []);

  // Handle modal close with cleanup
  const handleCloseModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cleanupModalAnimations();
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
  }, [cleanupModalAnimations]);

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

  // Clear all active filters
  const handleClearFilters = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await clearFilters();
      router.back();
    } catch (err) {
      console.error("Error clearing filters:", err);
      Alert.alert("Error", "Failed to clear filters");
    }
  };

  // Save a filter (create or update)
  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      Alert.alert("Error", "Filter name is required");
      return;
    }

    if (!semanticQuery.trim()) {
      Alert.alert("Error", "Search query is required");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const filterData: Partial<FilterType> = {
      name: filterName.trim(),
      semanticQuery: semanticQuery.trim(),
      criteria: {
        // Only include dateRange if we have valid dates
        ...(startDate && endDate ? {
          dateRange: {
            start: startDate,
            end: endDate,
          }
        } : {}),
        // Only include location if enabled and we have both location and radius
        ...(isLocationEnabled && location && radius ? {
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            radius: radius * 1000, // Convert km to meters
          }
        } : {}),
      },
    };

    try {
      let savedFilter;
      if (editingFilter) {
        // Update existing filter
        savedFilter = await updateFilter(editingFilter.id, filterData);
      } else {
        // Create new filter
        savedFilter = await createFilter(filterData);
      }

      // If the filter is active, apply it
      if (isActive) {
        await applyFilters([savedFilter.id]);
      }

      setModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Error saving filter:", err);
      Alert.alert("Error", "Failed to save filter");
    }
  };

  // Render a single filter item
  const renderFilterItem = ({ item, index }: { item: FilterType; index: number }) => {
    // Calculate date range in days
    const getDateRangeText = () => {
      if (!item.criteria.dateRange?.start || !item.criteria.dateRange?.end) return null;

      const start = new Date(item.criteria.dateRange.start);
      const end = new Date(item.criteria.dateRange.end);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) return "1d";
      if (diffDays < 7) return `${diffDays}d`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
      return `${Math.floor(diffDays / 30)}m`;
    };

    return (
      <Animated.View
        style={styles.filterCard}
        entering={SlideInDown.springify()
          .damping(15)
          .stiffness(100)
          .delay(index * 50)
          .withInitialValues({ transform: [{ translateY: 50 }, { scale: 0.8 }] })}
        exiting={SlideOutDown.springify().damping(15).stiffness(100)}
        layout={Layout.springify().damping(12).stiffness(100)}
        onLayout={() => {
          'worklet';
          if (!isMounted.current) {
            cancelAnimation(scrollY);
          }
        }}
      >
        <Animated.View
          style={styles.filterHeader}
          layout={LinearTransition.springify().damping(30).stiffness(300)}
        >
          <Animated.View
            style={styles.filterIconContainer}
            layout={LinearTransition.springify().damping(30).stiffness(300)}
          >
            {item.emoji ? (
              <Text style={styles.filterEmoji}>{item.emoji}</Text>
            ) : (
              <FilterIcon size={16} color="#93c5fd" />
            )}
          </Animated.View>

          <Animated.View
            style={styles.filterTitleContainer}
            layout={LinearTransition.springify().damping(30).stiffness(300)}
          >
            <Text style={styles.filterName}>{item.name}</Text>
            {item.semanticQuery && (
              <Text style={styles.filterQuery} numberOfLines={2}>
                {item.semanticQuery}
              </Text>
            )}
          </Animated.View>

          <Animated.View
            style={styles.filterDetails}
            layout={LinearTransition.springify().damping(30).stiffness(300)}
          >
            {/* Date Range */}
            {(item.criteria.dateRange?.start || item.criteria.dateRange?.end) && (
              <Animated.View
                style={styles.filterDetailItem}
                layout={LinearTransition.springify().damping(30).stiffness(300)}
              >
                <Calendar size={10} color="#93c5fd" />
                <Text style={styles.filterDetailText}>
                  {getDateRangeText()}
                </Text>
              </Animated.View>
            )}

            {/* Location Criteria */}
            {item.criteria.location && (
              <Animated.View
                style={styles.filterDetailItem}
                layout={LinearTransition.springify().damping(30).stiffness(300)}
              >
                <MapPin size={10} color="#93c5fd" />
                <Text style={styles.filterDetailText}>
                  {(item.criteria.location?.radius ? (item.criteria.location.radius / 1000).toFixed(1) : '0')}km
                </Text>
              </Animated.View>
            )}

            {activeFilterIds.includes(item.id) && (
              <Animated.View
                style={styles.activeCheckmark}
                entering={ZoomIn.duration(150).springify().damping(30).stiffness(300)}
                exiting={FadeOut.duration(150)}
                layout={LinearTransition.springify().damping(30).stiffness(300)}
              >
                <Check size={12} color="#40c057" />
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={styles.divider}
          layout={LinearTransition.springify().damping(30).stiffness(300)}
        />

        <Animated.View
          style={styles.filterActions}
          layout={LinearTransition.springify().damping(30).stiffness(300)}
        >
          <Animated.View layout={LinearTransition.springify().damping(30).stiffness(300)} style={{ flex: 1 }}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleApplyFilter(item)}
              activeOpacity={0.7}
            >
              <SearchIcon size={10} color="#93c5fd" />
              <Text style={styles.actionText}>Apply</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View layout={LinearTransition.springify().damping(30).stiffness(300)} style={{ flex: 1 }}>
            <TouchableOpacity
              style={[styles.actionButton, {
                backgroundColor: "rgba(255, 165, 0, 0.1)",
                borderColor: "rgba(255, 165, 0, 0.2)",
              }]}
              onPress={() => handleEditFilter(item)}
              activeOpacity={0.7}
            >
              <Edit2 size={10} color="#ffa500" />
              <Text style={[styles.actionText, { color: "#ffa500" }]}>Edit</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View layout={LinearTransition.springify().damping(30).stiffness(300)} style={{ flex: 1 }}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteFilter(item.id)}
              activeOpacity={0.7}
            >
              <Trash2 size={10} color="#f97583" />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    );
  };

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const scrollToInput = (reactNode: any) => {
    if (scrollViewRef.current) {
      reactNode.measureLayout(
        scrollViewRef.current.getInnerViewNode(),
        (x: number, y: number) => {
          scrollViewRef.current?.scrollTo({
            y: y - 100, // Scroll to 100px above the input
            animated: true,
          });
        },
        () => {
          console.log('measurement failed');
        }
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          headerAnimatedStyle,
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Filters</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreateFilter} activeOpacity={0.7}>
          <View style={styles.addButtonContainer}>
            <Plus size={22} color="#f8f9fa" />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {isLoading ? (
          <Animated.View
            style={styles.loadingContainer}
            entering={FadeIn}
            exiting={FadeOut}
            layout={LinearTransition.springify()}
          >
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Loading filters...</Text>
          </Animated.View>
        ) : error ? (
          <Animated.View
            style={styles.errorContainer}
            entering={FadeIn}
            exiting={FadeOut}
            layout={LinearTransition.springify()}
          >
            <View style={styles.errorIconContainer}>
              <AlertCircle size={40} color="#f97583" />
            </View>
            <Text style={styles.errorTitle}>Error Loading Filters</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchFilters} activeOpacity={0.7}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : filters.length === 0 ? (
          <Animated.View
            style={styles.emptyStateContainer}
            entering={FadeIn}
            exiting={FadeOut}
            layout={LinearTransition.springify()}
          >
            <View style={styles.emptyStateIconContainer}>
              <Sliders size={40} color="#93c5fd" />
            </View>
            <Text style={styles.emptyStateTitle}>No filters found</Text>
            <Text style={styles.emptyStateDescription}>
              Create smart filters to find events using natural language search.
            </Text>
            <TouchableOpacity
              style={styles.createFilterButton}
              onPress={handleCreateFilter}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Plus size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.createFilterText}>Create Filter</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.FlatList
            ref={listRef}
            data={filters}
            renderItem={renderFilterItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          />
        )}
      </View>

      {/* Bottom Button for Clear All */}
      {filters.length > 0 && (
        <Animated.View
          style={styles.bottomButtonContainer}
          entering={FadeIn}
          exiting={FadeOut}
          layout={LinearTransition.springify()}
        >
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearFilters}
            activeOpacity={0.7}
          >
            <X size={18} color="#f97583" />
            <Text style={styles.clearButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Filter Create/Edit Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
        onDismiss={cleanupModalAnimations}
      >
        <Animated.View
          style={[styles.modalContainer]}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          onLayout={() => {
            if (!isMounted.current) {
              cleanupModalAnimations();
            }
          }}
        >
          <Animated.View
            style={[styles.modalContent]}
            entering={SlideInDown.springify()
              .damping(12)
              .stiffness(100)
              .withInitialValues({ transform: [{ translateY: 50 }, { scale: 0.9 }] })}
            exiting={SlideOutDown.duration(150).withCallback((finished) => {
              'worklet';
              if (finished) {
                cleanupModalAnimations();
              }
            })}
            layout={Layout.springify().damping(12).stiffness(100)}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingFilter ? "Edit Smart Filter" : "Create Smart Filter"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseModal}
                activeOpacity={0.7}
              >
                <X size={20} color="#f8f9fa" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              keyboardDismissMode="on-drag"
            >
              {/* Filter Name - Most important, goes first */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Filter Name</Text>
                <TextInput
                  style={styles.input}
                  value={filterName}
                  onChangeText={setFilterName}
                  placeholder="Enter filter name"
                  placeholderTextColor="#adb5bd"
                  returnKeyType="next"
                  onFocus={(e) => scrollToInput(e.target)}
                />
              </View>

              {/* Active Toggle - Quick setting */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.formLabel}>Active</Text>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: "#3a3a3a", true: "#93c5fd" }}
                    thumbColor={isActive ? "#f8f9fa" : "#f8f9fa"}
                  />
                </View>
              </View>

              {/* Date Range - Common filter criteria */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Date Range</Text>
                <View style={styles.datePresetsContainer}>
                  <Text style={styles.datePresetsLabel}>Select a date range</Text>
                  <View style={styles.datePresetsGrid}>
                    {[
                      { label: '1 Day', days: 1 },
                      { label: '3 Days', days: 3 },
                      { label: '1 Week', days: 7 },
                      { label: '2 Weeks', days: 14 },
                    ].map((preset) => (
                      <TouchableOpacity
                        key={preset.label}
                        style={[
                          styles.datePresetButton,
                          startDate && endDate &&
                            new Date(endDate).getTime() - new Date(startDate).getTime() === preset.days * 24 * 60 * 60 * 1000
                            ? styles.datePresetButtonActive
                            : null
                        ]}
                        onPress={() => {
                          const today = new Date();
                          const endDate = new Date();
                          endDate.setDate(today.getDate() + preset.days);
                          setStartDate(today.toISOString().split('T')[0]);
                          setEndDate(endDate.toISOString().split('T')[0]);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.datePresetText,
                          startDate && endDate &&
                            new Date(endDate).getTime() - new Date(startDate).getTime() === preset.days * 24 * 60 * 60 * 1000
                            ? styles.datePresetTextActive
                            : null
                        ]}>{preset.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Location Section - Optional filter */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.formLabel}>Location Filter</Text>
                  <Switch
                    value={isLocationEnabled}
                    onValueChange={async (value) => {
                      setIsLocationEnabled(value);
                      if (value) {
                        try {
                          const { status } = await Location.requestForegroundPermissionsAsync();
                          if (status !== 'granted') {
                            Alert.alert(
                              'Permission Denied',
                              'Please enable location services to use this feature'
                            );
                            setIsLocationEnabled(false);
                            return;
                          }

                          const location = await Location.getCurrentPositionAsync({});
                          setLocation({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude
                          });

                          // Set a default radius if none is set
                          if (!radius) {
                            setRadius(5); // 5km default radius
                          }

                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (error) {
                          console.error('Error getting location:', error);
                          Alert.alert('Error', 'Failed to get current location');
                          setIsLocationEnabled(false);
                        }
                      } else {
                        setLocation(null);
                        setRadius(undefined);
                      }
                    }}
                    trackColor={{ false: "#3a3a3a", true: "#93c5fd" }}
                    thumbColor={isLocationEnabled ? "#f8f9fa" : "#f8f9fa"}
                  />
                </View>

                {isLocationEnabled && (
                  <View style={styles.radiusInput}>
                    <Text style={styles.locationLabel}>Radius (km)</Text>
                    <TextInput
                      style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                      value={radius ? radius.toString() : ''}
                      onChangeText={(value) => setRadius(value ? parseInt(value) : undefined)}
                      placeholder="5"
                      placeholderTextColor="#adb5bd"
                      keyboardType="numeric"
                      returnKeyType="done"
                      onFocus={(e) => scrollToInput(e.target)}
                    />
                  </View>
                )}
              </View>

              {/* Semantic Query - Most complex input, goes last */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Search Query</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                  value={semanticQuery}
                  onChangeText={setSemanticQuery}
                  placeholder="Describe what you're looking for..."
                  placeholderTextColor="#adb5bd"
                  multiline={true}
                  numberOfLines={3}
                  returnKeyType="next"
                  onFocus={(e) => scrollToInput(e.target)}
                />
                <Text style={styles.helperText}>
                  Examples: "Tech events in downtown", "Family activities this weekend", "Music
                  festivals in July"
                </Text>
              </View>

              {/* Added extra padding at the bottom */}
              <View style={{ height: 30 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCloseModal}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSaveFilter}
                activeOpacity={0.7}
              >
                <View style={styles.saveButtonContent}>
                  <Save size={18} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Filter</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Keyboard dismiss button at the bottom of modal */}
            <TouchableOpacity
              style={styles.keyboardDismissButton}
              onPress={dismissKeyboard}
              activeOpacity={0.7}
            >
              <Text style={styles.keyboardDismissText}>Tap to dismiss keyboard</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
};

export default FiltersView;

