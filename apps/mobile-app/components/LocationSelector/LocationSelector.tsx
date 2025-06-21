import React, { useCallback, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { MapPin, X } from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";
import Input from "../Input/Input";
import InfiniteScrollFlatList from "../Layout/InfintieScrollFlatList";
import * as Haptics from "expo-haptics";

export interface LocationOption {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [longitude, latitude]
  types?: string[];
  rating?: number;
  userRatingsTotal?: number;
  locationNotes?: string;
}

interface LocationSelectorProps {
  selectedLocation: LocationOption | null;
  onLocationSelect: (location: LocationOption) => void;
  onLocationClear: () => void;
  onSearch: (query: string) => Promise<void>;
  isLoading: boolean;
  searchResults: LocationOption[];
  error?: string;
  buttonText?: string;
}

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedLocation,
  onLocationSelect,
  onLocationClear,
  onSearch,
  isLoading,
  searchResults,
  error,
  buttonText = "Select Location",
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Debounce the search query with a 500ms delay
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Effect to trigger search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (debouncedSearchQuery.trim()) {
        setIsSearching(true);
        try {
          await onSearch(debouncedSearchQuery);
        } finally {
          setIsSearching(false);
        }
      }
    };

    performSearch();
  }, [debouncedSearchQuery, onSearch]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleSelect = useCallback(
    (location: LocationOption) => {
      Haptics.selectionAsync();
      onLocationSelect(location);
      setIsModalVisible(false);
      setSearchQuery("");
    },
    [onLocationSelect],
  );

  const handleClear = useCallback(() => {
    Haptics.selectionAsync();
    onLocationClear();
    setSearchQuery("");
  }, [onLocationClear]);

  const formatCoordinates = (location: LocationOption) => {
    const [lng, lat] = location.coordinates;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const renderLocationItem = useCallback(
    (location: LocationOption) => (
      <TouchableOpacity
        style={[
          styles.locationItem,
          selectedLocation?.id === location.id && styles.selectedLocationItem,
        ]}
        onPress={() => handleSelect(location)}
        activeOpacity={0.7}
      >
        <View style={styles.locationIcon}>
          <MapPin
            size={20}
            color={
              selectedLocation?.id === location.id
                ? COLORS.accent
                : COLORS.textSecondary
            }
          />
        </View>
        <View style={styles.locationContent}>
          <Text
            style={[
              styles.locationName,
              selectedLocation?.id === location.id && styles.selectedText,
            ]}
          >
            {location.name}
          </Text>
          <Text
            style={[
              styles.locationAddress,
              selectedLocation?.id === location.id && styles.selectedText,
            ]}
          >
            {location.address}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [selectedLocation, handleSelect],
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.7}
      >
        <MapPin size={18} color={COLORS.accent} style={styles.buttonIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.buttonText}>
            {selectedLocation ? selectedLocation.name : buttonText}
          </Text>
          {selectedLocation && selectedLocation.id === "initial" && (
            <Text style={styles.coordinatesText}>
              {formatCoordinates(selectedLocation)}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <TouchableOpacity
              onPress={() => setIsModalVisible(false)}
              style={styles.closeButton}
            >
              <X size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Input
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search for a place..."
              icon={MapPin}
              loading={isSearching}
              onRightIconPress={searchQuery ? handleClear : undefined}
              rightIcon={searchQuery ? X : undefined}
            />
          </View>

          <InfiniteScrollFlatList
            data={searchResults}
            renderItem={renderLocationItem}
            isLoading={isLoading}
            hasMore={false}
            error={error}
            emptyListMessage="No locations found"
            contentContainerStyle={styles.listContent}
            fetchMoreData={async () => {}}
          />

          <View style={styles.dismissButtonContainer}>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.dismissButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  button: {
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
  },
  buttonIcon: {
    opacity: 0.7,
  },
  coordinatesText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  listContent: {
    padding: 16,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  selectedLocationItem: {
    backgroundColor: COLORS.buttonBackground,
  },
  locationIcon: {
    marginRight: 12,
  },
  locationContent: {
    flex: 1,
  },
  locationName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
  },
  locationAddress: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
  },
  selectedText: {
    color: COLORS.accent,
  },
  dismissButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  dismissButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  dismissButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
  },
});
