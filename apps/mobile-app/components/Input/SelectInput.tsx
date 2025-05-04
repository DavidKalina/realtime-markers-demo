import React, { forwardRef, useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
  ActivityIndicator,
  Modal,
  FlatList,
  Text,
} from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { ChevronDown, LucideIcon, X } from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";

// Helper for RGBA background from hex
const getRgbaBackground = (hexColor: string, opacity: number) => {
  if (hexColor.startsWith("#") && hexColor.length === 7) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(147, 197, 253, ${opacity})`; // Fallback accent
};

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  icon?: LucideIcon;
  error?: string;
  delay?: number;
  style?: ViewStyle;
  loading?: boolean;
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  placeholder?: string;
}

const SelectInput = forwardRef<TextInput, SelectInputProps>(
  (
    {
      icon: Icon,
      error,
      delay = 0,
      style,
      loading = false,
      options,
      value,
      onChange,
      onSelect,
      placeholder = "Select an option",
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const debounceTimer = useRef<NodeJS.Timeout>();

    const selectedOption = options.find((opt) => opt.value === value);

    // Reset search query when dropdown closes
    useEffect(() => {
      if (!isOpen && selectedOption) {
        setSearchQuery(selectedOption.label);
        setDebouncedQuery(selectedOption.label);
      }
    }, [isOpen, selectedOption]);

    // Debounce the search query
    useEffect(() => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        setDebouncedQuery(searchQuery);
      }, 300); // 300ms delay

      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    }, [searchQuery]);

    // Call onChange with debounced query
    useEffect(() => {
      if (debouncedQuery !== "") {
        onChange(debouncedQuery);
      }
    }, [debouncedQuery, onChange]);

    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (option: SelectOption) => {
      if (onSelect) {
        onSelect(option.value);
      }
      setSearchQuery(option.label);
      setDebouncedQuery(option.label);
      setIsOpen(false);
    };

    const handleClear = () => {
      onChange("");
      setSearchQuery("");
      setDebouncedQuery("");
    };

    return (
      <>
        <Animated.View
          entering={FadeInDown.duration(600).delay(delay).springify()}
          layout={LinearTransition.springify()}
          style={[styles.container, error && styles.errorContainer, style]}
        >
          {Icon && (
            <View style={styles.iconContainer}>
              <Icon size={18} color={error ? "#f97583" : "#93c5fd"} />
            </View>
          )}
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setIsOpen(true)}
            disabled={loading}
          >
            <Text
              style={[
                styles.input,
                error && styles.errorInput,
                !selectedOption && !searchQuery && styles.placeholder,
              ]}
            >
              {selectedOption ? selectedOption.label : searchQuery || placeholder}
            </Text>
          </TouchableOpacity>
          {loading ? (
            <View style={styles.rightIconContainer}>
              <ActivityIndicator size="small" color="#93c5fd" />
            </View>
          ) : (
            <View style={styles.rightIconContainer}>
              {selectedOption ? (
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                  <X size={16} color={error ? "#f97583" : "#93c5fd"} />
                </TouchableOpacity>
              ) : (
                <ChevronDown size={18} color={error ? "#f97583" : "#93c5fd"} />
              )}
            </View>
          )}
        </Animated.View>

        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.option, item.value === value && styles.selectedOption]}
                      onPress={() => handleSelect(item)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          item.value === value && styles.selectedOptionText,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                  style={styles.optionsList}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No results found</Text>
                    </View>
                  }
                />
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 55,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  errorContainer: {
    borderColor: "#f97583",
  },
  iconContainer: {
    marginRight: 10,
  },
  inputContainer: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
  },
  rightIconContainer: {
    padding: 8,
  },
  input: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  placeholder: {
    color: "#808080",
  },
  errorInput: {
    color: "#f97583",
  },
  clearButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
    overflow: "hidden",
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  searchInput: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  selectedOption: {
    backgroundColor: getRgbaBackground(COLORS.accent, 0.1),
  },
  optionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  selectedOptionText: {
    color: COLORS.accent,
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
});

export default SelectInput;
