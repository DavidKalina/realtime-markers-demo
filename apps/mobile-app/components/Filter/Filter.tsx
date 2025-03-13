import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  Switch,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  ArrowLeft,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  X,
  Save,
  SearchIcon,
} from "lucide-react-native";
import apiClient, { Filter as FilterType } from "../../services/ApiClient";
import { filterStyles } from "./styles";

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
    <Animated.View entering={FadeIn.duration(300).delay(100)} style={filterStyles.filterCard}>
      <View style={filterStyles.filterHeader}>
        <View style={filterStyles.filterIconTitle}>
          <Filter size={20} color="#93c5fd" />
          <Text style={filterStyles.filterName}>{item.name}</Text>
        </View>
        {item.isActive && (
          <View style={filterStyles.activeBadge}>
            <Text style={filterStyles.activeText}>ACTIVE</Text>
          </View>
        )}
      </View>

      <View style={filterStyles.filterDetails}>
        {/* Semantic Query */}
        {item.semanticQuery && (
          <View style={filterStyles.criteriaSection}>
            <Text style={filterStyles.criteriaLabel}>Search Query:</Text>
            <Text style={filterStyles.criteriaValue}>{item.semanticQuery}</Text>
          </View>
        )}

        {/* Date Range */}
        {(item.criteria.dateRange?.start || item.criteria.dateRange?.end) && (
          <View style={filterStyles.criteriaSection}>
            <Text style={filterStyles.criteriaLabel}>Date Range:</Text>
            <Text style={filterStyles.criteriaValue}>
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

      <View style={filterStyles.filterActions}>
        <TouchableOpacity style={filterStyles.actionButton} onPress={() => handleApplyFilter(item)}>
          <SearchIcon size={16} color="#93c5fd" />
          <Text style={filterStyles.actionText}>Apply</Text>
        </TouchableOpacity>

        <TouchableOpacity style={filterStyles.actionButton} onPress={() => handleEditFilter(item)}>
          <Edit2 size={16} color="#93c5fd" />
          <Text style={filterStyles.actionText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={filterStyles.actionButton}
          onPress={() => handleDeleteFilter(item.id)}
        >
          <Trash2 size={16} color="#f97583" />
          <Text style={[filterStyles.actionText, { color: "#f97583" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={filterStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header */}
      <View style={filterStyles.header}>
        <TouchableOpacity style={filterStyles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={filterStyles.headerTitle}>Smart Filters</Text>
        <TouchableOpacity style={filterStyles.addButton} onPress={handleCreateFilter}>
          <Plus size={22} color="#f8f9fa" />
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={filterStyles.contentArea}>
        {loading ? (
          <View style={filterStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={filterStyles.loadingText}>Loading filters...</Text>
          </View>
        ) : error ? (
          <View style={filterStyles.errorContainer}>
            <Text style={filterStyles.errorText}>{error}</Text>
            <TouchableOpacity style={filterStyles.retryButton} onPress={fetchFilters}>
              <Text style={filterStyles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filters.length === 0 ? (
          <View style={filterStyles.noResults}>
            <Text style={filterStyles.noResultsText}>No filters found</Text>
            <Text style={filterStyles.noResultsSubtext}>
              Create smart filters to find events using natural language search.
            </Text>
            <TouchableOpacity style={filterStyles.createFilterButton} onPress={handleCreateFilter}>
              <Plus size={18} color="#333" />
              <Text style={filterStyles.createFilterText}>Create Filter</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filters}
            renderItem={renderFilterItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={filterStyles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Bottom Button for Clear All */}
      {filters.length > 0 && (
        <View style={filterStyles.bottomButtonContainer}>
          <TouchableOpacity style={filterStyles.clearButton} onPress={handleClearFilters}>
            <X size={18} color="#f8f9fa" />
            <Text style={filterStyles.clearButtonText}>Clear All Filters</Text>
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
        <View style={filterStyles.modalContainer}>
          <View style={filterStyles.modalContent}>
            <View style={filterStyles.modalHeader}>
              <Text style={filterStyles.modalTitle}>
                {editingFilter ? "Edit Smart Filter" : "Create Smart Filter"}
              </Text>
              <TouchableOpacity
                style={filterStyles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <X size={20} color="#f8f9fa" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={filterStyles.modalScrollContent}
            >
              {/* Filter Name */}
              <View style={filterStyles.formGroup}>
                <Text style={filterStyles.formLabel}>Filter Name</Text>
                <TextInput
                  style={filterStyles.input}
                  value={filterName}
                  onChangeText={setFilterName}
                  placeholder="Enter filter name"
                  placeholderTextColor="#adb5bd"
                />
              </View>

              {/* Active Toggle */}
              <View style={filterStyles.formGroup}>
                <View style={filterStyles.switchContainer}>
                  <Text style={filterStyles.formLabel}>Active</Text>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: "#3a3a3a", true: "#93c5fd" }}
                    thumbColor={isActive ? "#f8f9fa" : "#f8f9fa"}
                  />
                </View>
              </View>

              {/* Semantic Query */}
              <View style={filterStyles.formGroup}>
                <Text style={filterStyles.formLabel}>Search Query</Text>
                <TextInput
                  style={[filterStyles.input, { height: 80, textAlignVertical: "top" }]}
                  value={semanticQuery}
                  onChangeText={setSemanticQuery}
                  placeholder="Describe what you're looking for..."
                  placeholderTextColor="#adb5bd"
                  multiline={true}
                  numberOfLines={3}
                />
                <Text style={filterStyles.helperText}>
                  Examples: "Tech events in downtown", "Family activities this weekend", "Music
                  festivals in July"
                </Text>
              </View>

              {/* Date Range */}
              <View style={filterStyles.formGroup}>
                <Text style={filterStyles.formLabel}>Date Range (Optional)</Text>
                <View style={filterStyles.dateInputContainer}>
                  <View style={filterStyles.dateInput}>
                    <Text style={filterStyles.dateLabel}>Start</Text>
                    <TextInput
                      style={filterStyles.input}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#adb5bd"
                    />
                  </View>
                  <View style={filterStyles.dateInput}>
                    <Text style={filterStyles.dateLabel}>End</Text>
                    <TextInput
                      style={filterStyles.input}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#adb5bd"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={filterStyles.modalFooter}>
              <TouchableOpacity
                style={filterStyles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={filterStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={filterStyles.saveButton} onPress={handleSaveFilter}>
                <Save size={18} color="#333" />
                <Text style={filterStyles.saveButtonText}>Save Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default FiltersView;
