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
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import apiClient, { Filter as FilterType } from "../../services/ApiClient";

const FiltersView: React.FC = () => {
  const [filters, setFilters] = useState<FilterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFilter, setEditingFilter] = useState<FilterType | null>(null);
  const [filterName, setFilterName] = useState("");
  const [semanticQuery, setSemanticQuery] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const scrollY = React.useRef(new Animated.Value(0)).current;

  // Animation for header shadow
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const router = useRouter();

  // Fetch all filters when component mounts
  useEffect(() => {
    fetchFilters();
  }, []);

  // Fetch all filters from API
  const fetchFilters = async () => {
    setLoading(true);
    setError(null);

    try {
      const userFilters = await apiClient.getUserFilters();
      setFilters(userFilters);
    } catch (err) {
      setError(`Failed to load filters: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error("Error fetching filters:", err);
    } finally {
      setLoading(false);
    }
  };

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
    setModalVisible(true);
  };

  // Open modal to edit an existing filter
  const handleEditFilter = (filter: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingFilter(filter);
    setFilterName(filter.name);
    setSemanticQuery(filter.semanticQuery || "");
    setIsActive(filter.isActive);
    setStartDate(filter.criteria.dateRange?.start || "");
    setEndDate(filter.criteria.dateRange?.end || "");
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
            await apiClient.deleteFilter(filterId);
            setFilters(filters.filter((filter) => filter.id !== filterId));
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
      await apiClient.applyFilters([filter.id]);
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
      await apiClient.clearFilters();
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

    // Prepare the filter data
    const filterData: Partial<FilterType> = {
      name: filterName.trim(),
      isActive,
      semanticQuery: semanticQuery.trim(),
      criteria: {
        dateRange: {
          start: startDate || undefined,
          end: endDate || undefined,
        },
      },
    };

    try {
      let updatedFilter: FilterType;

      if (editingFilter) {
        // Update existing filter
        updatedFilter = await apiClient.updateFilter(editingFilter.id, filterData);
        setFilters(filters.map((f) => (f.id === updatedFilter.id ? updatedFilter : f)));
      } else {
        // Create new filter
        updatedFilter = await apiClient.createFilter(filterData);
        setFilters([...filters, updatedFilter]);
      }

      setModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Error saving filter:", err);
      Alert.alert("Error", "Failed to save filter");
    }
  };

  // Render a single filter item
  const renderFilterItem = ({ item }: { item: FilterType }) => (
    <View style={styles.filterCard}>
      <View style={styles.filterHeader}>
        <View style={styles.filterIconContainer}>
          <FilterIcon size={18} color="#93c5fd" />
        </View>
        <View style={styles.filterTitleContainer}>
          <Text style={styles.filterName}>{item.name}</Text>
          {item.isActive && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.filterDetails}>
        {/* Semantic Query */}
        {item.semanticQuery && (
          <View style={styles.criteriaSection}>
            <Text style={styles.criteriaLabel}>Search Query:</Text>
            <Text style={styles.criteriaValue}>{item.semanticQuery}</Text>
          </View>
        )}

        {/* Date Range */}
        {(item.criteria.dateRange?.start || item.criteria.dateRange?.end) && (
          <View style={styles.criteriaSection}>
            <View style={styles.criteriaRow}>
              <Calendar size={14} color="#93c5fd" style={styles.criteriaIcon} />
              <Text style={styles.criteriaLabel}>Date Range:</Text>
            </View>
            <Text style={styles.criteriaValue}>
              {item.criteria.dateRange?.start
                ? new Date(item.criteria.dateRange.start).toLocaleDateString()
                : "Any"}
              {" to "}
              {item.criteria.dateRange?.end
                ? new Date(item.criteria.dateRange.end).toLocaleDateString()
                : "Any"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.filterActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleApplyFilter(item)}
          activeOpacity={0.7}
        >
          <SearchIcon size={16} color="#93c5fd" />
          <Text style={styles.actionText}>Apply</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditFilter(item)}
          activeOpacity={0.7}
        >
          <Edit2 size={16} color="#93c5fd" />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteFilter(item.id)}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color="#f97583" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          {
            shadowOpacity: headerShadowOpacity,
            borderBottomColor: headerShadowOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", "#3a3a3a"],
            }),
          },
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Loading filters...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <AlertCircle size={40} color="#f97583" />
            </View>
            <Text style={styles.errorTitle}>Error Loading Filters</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchFilters} activeOpacity={0.7}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filters.length === 0 ? (
          <View style={styles.emptyStateContainer}>
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
          </View>
        ) : (
          <Animated.FlatList
            data={filters}
            renderItem={renderFilterItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
          />
        )}
      </View>

      {/* Bottom Button for Clear All */}
      {filters.length > 0 && (
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearFilters}
            activeOpacity={0.7}
          >
            <X size={18} color="#f97583" />
            <Text style={styles.clearButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Create/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingFilter ? "Edit Smart Filter" : "Create Smart Filter"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <X size={20} color="#f8f9fa" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Filter Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Filter Name</Text>
                <TextInput
                  style={styles.input}
                  value={filterName}
                  onChangeText={setFilterName}
                  placeholder="Enter filter name"
                  placeholderTextColor="#adb5bd"
                />
              </View>

              {/* Active Toggle */}
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

              {/* Semantic Query */}
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
                />
                <Text style={styles.helperText}>
                  Examples: "Tech events in downtown", "Family activities this weekend", "Music
                  festivals in July"
                </Text>
              </View>

              {/* Date Range */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Date Range (Optional)</Text>
                <View style={styles.dateInputContainer}>
                  <View style={styles.dateInput}>
                    <Text style={styles.dateLabel}>Start</Text>
                    <TextInput
                      style={styles.input}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#adb5bd"
                    />
                  </View>
                  <View style={styles.dateInput}>
                    <Text style={styles.dateLabel}>End</Text>
                    <TextInput
                      style={styles.input}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#adb5bd"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveFilter}
                activeOpacity={0.7}
              >
                <View style={styles.saveButtonContent}>
                  <Save size={18} color="#333" />
                  <Text style={styles.saveButtonText}>Save Filter</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Inline styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    backgroundColor: "#333",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 3,
    elevation: 0,
  },

  backButton: {
    padding: 8,
    borderRadius: 20,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },

  addButton: {
    padding: 8,
  },

  addButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Content area
  contentArea: {
    flex: 1,
  },

  // List styles
  listContent: {
    padding: 16,
    paddingBottom: 100, // Extra padding for bottom button
  },

  // Filter card styles
  filterCard: {
    backgroundColor: "#3a3a3a",
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },

  filterIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  filterTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  filterName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
    marginRight: 12,
  },

  activeBadge: {
    backgroundColor: "rgba(64, 192, 87, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(64, 192, 87, 0.3)",
  },

  activeText: {
    color: "#40c057",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  filterDetails: {
    padding: 16,
    paddingTop: 0,
  },

  criteriaSection: {
    marginBottom: 12,
  },

  criteriaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  criteriaIcon: {
    marginRight: 6,
  },

  criteriaLabel: {
    fontSize: 14,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 4,
  },

  criteriaValue: {
    fontSize: 14,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    lineHeight: 20,
    paddingLeft: 4,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 16,
  },

  filterActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },

  actionText: {
    color: "#93c5fd",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginLeft: 8,
  },

  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.2)",
  },

  deleteText: {
    color: "#f97583",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginLeft: 8,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },

  loadingText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 16,
    marginTop: 16,
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },

  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },

  retryButton: {
    backgroundColor: "rgba(147, 197, 253, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  retryButtonText: {
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "600",
    fontSize: 14,
  },

  // Empty state
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },

  emptyStateDescription: {
    fontSize: 14,
    color: "#adb5bd",
    textAlign: "center",
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },

  createFilterButton: {
    position: "relative",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    overflow: "hidden",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },

  buttonGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  createFilterText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  // Bottom button
  bottomButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#333",
    borderTopWidth: 1,
    borderTopColor: "#3a3a3a",
  },

  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },

  clearButtonText: {
    color: "#f97583",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginLeft: 8,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  modalContent: {
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    width: "100%",
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalScrollContent: {
    padding: 16,
  },

  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },

  // Form styles
  formGroup: {
    marginBottom: 20,
  },

  formLabel: {
    fontSize: 14,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "rgba(66, 66, 66, 0.6)",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  dateInputContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  dateInput: {
    flex: 1,
  },

  dateLabel: {
    fontSize: 12,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },

  helperText: {
    fontSize: 12,
    color: "#adb5bd",
    marginTop: 4,
    fontStyle: "italic",
    lineHeight: 16,
  },

  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },

  cancelButtonText: {
    color: "#adb5bd",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },

  saveButton: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    overflow: "hidden",
  },

  saveButtonGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  saveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  saveButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginLeft: 8,
  },
});

export default FiltersView;
