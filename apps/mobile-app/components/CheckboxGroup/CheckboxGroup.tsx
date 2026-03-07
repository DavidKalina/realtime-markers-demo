import { X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useColors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  type Colors,
} from "@/theme";

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
  initialModalOpen?: boolean;
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
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <TouchableOpacity
    onPress={onToggle}
    style={[styles.itemCard, isSelected && styles.selectedItemCard]}
  >
    <View style={styles.itemInfo}>
      <Text style={styles.itemName}>
        {item.firstName || item.email || item.id}
      </Text>
      {item.lastName && (
        <Text style={styles.itemDescription}>{item.lastName}</Text>
      )}
    </View>
    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]} />
  </TouchableOpacity>
  );
};

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
  initialModalOpen = false,
  renderItem,
}: CheckboxGroupProps<T>) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isModalVisible, setIsModalVisible] = useState(initialModalOpen);

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

      {/* Display selected items */}
      {selectedItems.length > 0 && (
        <View style={styles.selectedItemsContainer}>
          {selectedItems.map((item) => (
            <View key={item.id} style={styles.selectedItemDisplay}>
              <Text style={styles.selectedItemText}>
                {item.firstName || item.email || item.id}
              </Text>
              {item.lastName && (
                <Text style={styles.selectedItemDescription}>
                  {item.lastName}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

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
              <X size={24} color={colors.text.primary} />
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

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    width: "100%",
  },
  button: {
    backgroundColor: colors.border.subtle,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
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
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  closeButton: {
    padding: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  selectedItemCard: {
    borderColor: colors.accent.primary,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.xs,
  },
  itemDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.accent.primary,
    marginLeft: spacing.md,
  },
  checkboxSelected: {
    backgroundColor: colors.accent.primary,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
  },
  errorText: {
    color: "#f97583",
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
  },
  dismissButtonContainer: {
    padding: spacing["2xl"],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.primary,
  },
  dismissButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  dismissButtonText: {
    color: colors.fixed.black,
    fontSize: fontSize.lg,
    fontWeight: "800",
    fontFamily: fontFamily.mono,
  },
  selectedItemsContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  selectedItemDisplay: {
    padding: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  selectedItemText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },
  selectedItemDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    marginTop: 2,
    fontFamily: fontFamily.mono,
  },
});
