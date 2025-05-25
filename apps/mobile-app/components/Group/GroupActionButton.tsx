import React from "react";
import { View, StyleSheet } from "react-native";
import { LogOut, Trash2 } from "lucide-react-native";
import ActionButton from "@/components/Buttons/ActionButton";

interface GroupActionButtonProps {
  isAdmin: boolean;
  onLeave: () => void;
  onDelete: () => void;
  isLeaving: boolean;
  isDeleting: boolean;
}

export const GroupActionButton: React.FC<GroupActionButtonProps> = ({
  isAdmin,
  onLeave,
  onDelete,
  isLeaving,
  isDeleting,
}) => {
  return (
    <View style={styles.container}>
      {isAdmin ? (
        <ActionButton
          variant="danger"
          label="Delete Group"
          icon={Trash2}
          onPress={onDelete}
          isLoading={isDeleting}
        />
      ) : (
        <ActionButton
          variant="danger"
          label="Leave Group"
          icon={LogOut}
          onPress={onLeave}
          isLoading={isLeaving}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
});
