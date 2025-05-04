import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  ActivityIndicator,
  Modal,
  FlatList,
  Text,
} from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { ChevronDown, LucideIcon, X, Check } from "lucide-react-native";
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

interface MultiSelectInputProps {
  icon?: LucideIcon;
  error?: string;
  delay?: number;
  style?: ViewStyle;
  loading?: boolean;
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
}

const MultiSelectInput = forwardRef<TextInput, MultiSelectInputProps>(
  (
    {
      icon: Icon,
      error,
      delay = 0,
      style,
      loading = false,
      options,
      values,
      onChange,
      placeholder = "Select options",
      maxSelections,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const selectedOptions = options.filter((opt) => values.includes(opt.value));
    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (option: SelectOption) => {
      const newValues = values.includes(option.value)
        ? values.filter((v) => v !== option.value)
        : [...values, option.value];

      if (maxSelections && newValues.length > maxSelections) {
        // If we've hit the max selections, remove the oldest selection
        newValues.shift();
      }

      onChange(newValues);
    };

    const handleClear = () => {
      onChange([]);
      setSearchQuery("");
    };

    const getDisplayText = () => {
      if (selectedOptions.length === 0) return placeholder;
      if (selectedOptions.length === 1) return selectedOptions[0].label;
      return `${selectedOptions.length} items selected`;
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
                selectedOptions.length === 0 && styles.placeholder,
              ]}
            >
              {getDisplayText()}
            </Text>
          </TouchableOpacity>
          {loading ? (
            <View style={styles.rightIconContainer}>
              <ActivityIndicator size="small" color="#93c5fd" />
            </View>
          ) : (
            <View style={styles.rightIconContainer}>
              {selectedOptions.length > 0 ? (
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
              {maxSelections && (
                <View style={styles.selectionLimit}>
                  <Text style={styles.selectionLimitText}>
                    {values.length}/{maxSelections} selected
                  </Text>
                </View>
              )}
              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => {
                  const isSelected = values.includes(item.value);
                  return (
                    <TouchableOpacity
                      style={[styles.option, isSelected && styles.selectedOption]}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={styles.checkbox}>
                        {isSelected && <Check size={16} color={COLORS.accent} strokeWidth={3} />}
                      </View>
                      <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                style={styles.optionsList}
              />
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
  selectionLimit: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.cardBackground,
  },
  selectionLimitText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  selectedOption: {
    backgroundColor: getRgbaBackground(COLORS.accent, 0.1),
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.accent,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    flex: 1,
  },
  selectedOptionText: {
    color: COLORS.accent,
    fontWeight: "600",
  },
});

export default MultiSelectInput;
