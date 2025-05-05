import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, FlatList, TouchableOpacity, Pressable } from "react-native";
import { Friend } from "@/services/ApiClient";
import { useFetchMyFriends } from "@/hooks/useFetchMyFriends";
import { COLORS } from "../Layout/ScreenLayout";
import { X } from "lucide-react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

interface CheckboxGroupProps {
  selectedFriends: Friend[];
  onSelectionChange: (friends: Friend[]) => void;
  buttonText?: string;
}

const FriendCard = ({
  friend,
  isSelected,
  onToggle,
}: {
  friend: Friend;
  isSelected: boolean;
  onToggle: () => void;
}) => (
  <TouchableOpacity
    onPress={onToggle}
    style={[styles.friendCard, isSelected && styles.selectedFriendCard]}
  >
    <View style={styles.friendInfo}>
      <Text style={styles.friendName}>{friend.displayName || friend.email}</Text>
      {friend.displayName && <Text style={styles.friendEmail}>{friend.email}</Text>}
    </View>
    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]} />
  </TouchableOpacity>
);

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  selectedFriends,
  onSelectionChange,
  buttonText = "Select Friends",
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { friends, isLoading, error } = useFetchMyFriends();

  const toggleFriend = (friend: Friend) => {
    const isSelected = selectedFriends.some((f) => f.id === friend.id);
    if (isSelected) {
      onSelectionChange(selectedFriends.filter((f) => f.id !== friend.id));
    } else {
      onSelectionChange([...selectedFriends, friend]);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={() => setIsModalVisible(true)}>
        <Text style={styles.buttonText}>
          {buttonText} ({selectedFriends.length})
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
            <Text style={styles.modalTitle}>Select Friends</Text>
            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
              <X size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centerContent}>
              <Text style={styles.loadingText}>Loading friends...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>Error loading friends</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <FriendCard
                  friend={item}
                  isSelected={selectedFriends.some((f) => f.id === item.id)}
                  onToggle={() => toggleFriend(item)}
                />
              )}
              contentContainerStyle={styles.listContent}
            />
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
  friendCard: {
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
  selectedFriendCard: {
    borderColor: COLORS.accent,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  friendEmail: {
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
});
