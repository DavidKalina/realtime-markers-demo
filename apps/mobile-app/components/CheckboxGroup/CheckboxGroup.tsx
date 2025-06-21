import { X } from "lucide-react-native";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../Layout/ScreenLayout";

// Generic item interface that can be used for any selectable items
export interface SelectableItem {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  [key: string]: string | number | boolean | undefined; // Allow additional properties with specific types
}

interface CheckboxGroupProps<T extends SelectableItem> {
  selectedItems: T[];
  onSelectionChange: (items: T[]) => void;
  items: T[];
  isLoading?: boolean;
  error?: string | null;
  buttonText?: string;
  modalTitle?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  errorMessage?: string;
  renderItem?: (
    item: T,
    isSelected: boolean,
    onToggle: () => void,
  ) => React.ReactElement;
}

const DefaultItemCard = <T extends SelectableItem>({
  item,
  isSelected,
  onToggle,
}: {
  item: T;
  isSelected: boolean;
  onToggle: () => void;
}) => (
  <TouchableOpacity
    onPress={onToggle}
    style={[styles.itemCard, isSelected && styles.selectedItemCard]}
  >
    <View style={styles.itemInfo}>
      <Text style={styles.itemName}>
        {item.firstName && item.lastName
          ? `${item.firstName} ${item.lastName}`
          : item.email || item.id}
      </Text>
      {item.email && <Text style={styles.itemEmail}>{item.email}</Text>}
    </View>
    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]} />
  </TouchableOpacity>
);

export const CheckboxGroup = <T extends SelectableItem>({
  selectedItems,
  onSelectionChange,
  items,
  isLoading = false,
  error = null,
  buttonText = "Select Items",
  modalTitle = "Select Items",
  emptyMessage = "No items available",
  loadingMessage = "Loading items...",
  errorMessage = "Error loading items",
  renderItem,
}: CheckboxGroupProps<T>) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const toggleItem = (item: T) => {
    const isSelected = selectedItems.some((i) => i.id === item.id);
    if (isSelected) {
      onSelectionChange(selectedItems.filter((i) => i.id !== item.id));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
  };

  const renderItemComponent = (
    item: T,
    isSelected: boolean,
    onToggle: () => void,
  ) => {
    if (renderItem) {
      return renderItem(item, isSelected, onToggle);
    }
    return (
      <DefaultItemCard
        item={item}
        isSelected={isSelected}
        onToggle={onToggle}
      />
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setIsModalVisible(true)}
      >
        <Text style={styles.buttonText}>
          {buttonText} ({selectedItems.length})
        </Text>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <TouchableOpacity
              onPress={() => setIsModalVisible(false)}
              style={styles.closeButton}
            >
              <X size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centerContent}>
              <Text style={styles.loadingText}>{loadingMessage}</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) =>
                  renderItemComponent(
                    item,
                    selectedItems.some((i) => i.id === item.id),
                    () => toggleItem(item),
                  )
                }
                contentContainerStyle={styles.listContent}
              />
              <View style={styles.dismissButtonContainer}>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.dismissButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
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
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
  closeButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  selectedItemCard: {
    borderColor: COLORS.accent,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  itemEmail: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.accent,
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: COLORS.accent,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  errorText: {
    color: "#f97583",
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  dismissButtonContainer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.background,
  },
  dismissButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  dismissButtonText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "SpaceMono",
  },
});
