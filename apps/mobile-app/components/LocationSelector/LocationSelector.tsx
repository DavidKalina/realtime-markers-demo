import React, { useCallback, useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { MapPin, X } from "lucide-react-native";
import {
  useColors,
  type Colors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
  radius,
} from "@/theme";
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
                ? colors.accent.primary
                : colors.text.secondary
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
        <MapPin
          size={18}
          color={colors.accent.primary}
          style={styles.buttonIcon}
        />
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
              <X size={24} color={colors.text.primary} />
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      width: "100%",
    },
    button: {
      backgroundColor: colors.border.subtle,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing._14,
      borderWidth: 1,
      borderColor: colors.border.medium,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    buttonText: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
    },
    buttonIcon: {
      opacity: 0.7,
    },
    coordinatesText: {
      color: colors.text.secondary,
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      marginTop: 2,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    modalTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: radius["2xl"],
      backgroundColor: colors.border.subtle,
      justifyContent: "center",
      alignItems: "center",
    },
    searchContainer: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    listContent: {
      padding: spacing.lg,
    },
    locationItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    selectedLocationItem: {
      backgroundColor: colors.border.subtle,
    },
    locationIcon: {
      marginRight: spacing.md,
    },
    locationContent: {
      flex: 1,
    },
    locationName: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
    },
    locationAddress: {
      color: colors.text.secondary,
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      marginTop: 2,
    },
    selectedText: {
      color: colors.accent.primary,
    },
    dismissButtonContainer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
    dismissButton: {
      backgroundColor: colors.accent.primary,
      borderRadius: radius.md,
      paddingVertical: spacing._14,
      alignItems: "center",
    },
    dismissButtonText: {
      color: colors.fixed.black,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },
  });
