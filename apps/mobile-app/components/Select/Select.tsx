import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  FlatList,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { COLORS } from "../Layout/ScreenLayout";
import Input from "../Input/Input";

export interface SelectOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ size: number; color: string }>;
}

interface SelectProps {
  value?: SelectOption;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  loading?: boolean;
  searchable?: boolean;
  onSearch?: (query: string) => Promise<void>;
  onChange: (option: SelectOption) => void;
  onClear?: () => void;
  style?: ViewStyle;
}

export const Select: React.FC<SelectProps> = ({
  value,
  options,
  placeholder = "Select an option",
  label,
  error,
  loading = false,
  searchable = false,
  onSearch,
  onChange,
  onClear,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const toggleDropdown = useCallback(() => {
    Haptics.selectionAsync();
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (option: SelectOption) => {
      Haptics.selectionAsync();
      onChange(option);
      setIsOpen(false);
      setSearchQuery("");
    },
    [onChange],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (onSearch) {
        setIsSearching(true);
        try {
          await onSearch(query);
        } finally {
          if (isMounted.current) {
            setIsSearching(false);
          }
        }
      }
    },
    [onSearch],
  );

  const handleClear = useCallback(() => {
    Haptics.selectionAsync();
    if (onClear) {
      onClear();
    }
    setSearchQuery("");
  }, [onClear]);

  const renderOption = useCallback(
    ({ item }: { item: SelectOption }) => (
      <TouchableOpacity
        style={[styles.option, value?.id === item.id && styles.selectedOption]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        {item.icon && (
          <View style={styles.optionIcon}>
            <item.icon
              size={20}
              color={
                value?.id === item.id ? COLORS.accent : COLORS.textSecondary
              }
            />
          </View>
        )}
        <View style={styles.optionContent}>
          <Text
            style={[
              styles.optionLabel,
              value?.id === item.id && styles.selectedText,
            ]}
          >
            {item.label}
          </Text>
          {item.description && (
            <Text
              style={[
                styles.optionDescription,
                value?.id === item.id && styles.selectedText,
              ]}
            >
              {item.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [value, handleSelect],
  );

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.trigger,
          error && styles.errorTrigger,
          value && styles.hasValue,
        ]}
        onPress={toggleDropdown}
        activeOpacity={0.7}
      >
        {value ? (
          <View style={styles.selectedContent}>
            {value.icon && (
              <View style={styles.selectedIcon}>
                <value.icon size={18} color={COLORS.accent} />
              </View>
            )}
            <View style={styles.selectedTextContainer}>
              <Text
                style={styles.selectedLabel}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {value.label}
              </Text>
              {value.description && (
                <Text
                  style={styles.selectedDescription}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {value.description}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={[styles.placeholder, error && styles.errorText]}>
            {placeholder}
          </Text>
        )}
        <View style={styles.triggerIcon}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : isOpen ? (
            <ChevronUp
              size={18}
              color={error ? COLORS.errorText : COLORS.accent}
            />
          ) : (
            <ChevronDown
              size={18}
              color={error ? COLORS.errorText : COLORS.accent}
            />
          )}
        </View>
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <Animated.View
            style={styles.modalContent}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
          >
            <Animated.View
              style={styles.dropdownContainer}
              entering={SlideInDown.springify()
                .damping(12)
                .stiffness(100)
                .withInitialValues({
                  transform: [{ translateY: 50 }, { scale: 0.9 }],
                })}
              exiting={SlideOutDown.duration(150)}
              layout={Layout.springify().damping(12).stiffness(100)}
            >
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>
                  {searchable ? "Search" : "Select an option"}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setIsOpen(false)}
                  activeOpacity={0.7}
                >
                  <X size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              {searchable && (
                <View style={styles.searchContainer}>
                  <Input
                    value={searchQuery}
                    onChangeText={handleSearch}
                    placeholder="Search..."
                    icon={Search}
                    loading={isSearching}
                    onRightIconPress={searchQuery ? handleClear : undefined}
                    rightIcon={searchQuery ? X : undefined}
                  />
                </View>
              )}

              <FlatList
                data={options}
                renderItem={renderOption}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.optionsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    color: COLORS.accent,
    fontFamily: "Poppins-Regular",
    fontWeight: "500",
    marginBottom: 8,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 55,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  errorTrigger: {
    borderColor: COLORS.errorBorder,
  },
  hasValue: {
    borderColor: COLORS.accent,
  },
  selectedContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  selectedIcon: {
    marginRight: 10,
  },
  selectedTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  selectedLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
  },
  selectedDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
  },
  placeholder: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
  },
  triggerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  dropdownContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    padding: 16,
    paddingTop: 0,
  },
  optionsList: {
    paddingVertical: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  selectedOption: {
    backgroundColor: COLORS.buttonBackground,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
  },
  optionDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
  },
  selectedText: {
    color: COLORS.accent,
  },
});
