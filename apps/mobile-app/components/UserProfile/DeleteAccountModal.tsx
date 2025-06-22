// import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  BounceIn,
  BounceOut,
  LinearTransition,
} from "react-native-reanimated";
import { COLORS } from "@/components/Layout/ScreenLayout";

interface DeleteAccountModalProps {
  visible: boolean;
  password: string;
  setPassword: (password: string) => void;
  deleteError: string;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  visible,
  password,
  setPassword,
  deleteError,
  isDeleting,
  onClose,
  onDelete,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        <Animated.View
          entering={BounceIn.duration(500)
            .springify()
            .damping(15)
            .stiffness(200)}
          layout={LinearTransition.springify()}
          style={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Delete Account</Text>
          <Text style={styles.dialogText}>
            Are you sure you want to delete your account? This action cannot be
            undone.
          </Text>
          <Text style={styles.dialogSubText}>
            Please enter your password to confirm deletion:
          </Text>
          <TextInput
            style={styles.passwordInput}
            secureTextEntry
            placeholder="Enter your password"
            placeholderTextColor={COLORS.textSecondary}
            value={password}
            onChangeText={setPassword}
          />
          {deleteError ? (
            <Animated.View
              entering={BounceIn.duration(500)
                .springify()
                .damping(15)
                .stiffness(200)}
              exiting={BounceOut.duration(300)}
            >
              <Text style={styles.errorText}>{deleteError}</Text>
            </Animated.View>
          ) : null}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isDeleting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deleteModalButton,
                isDeleting && styles.deleteModalButtonDisabled,
              ]}
              onPress={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.deleteModalButtonText}>Delete Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
    marginBottom: 16,
    textAlign: "center",
  },
  dialogText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: "Poppins-Regular",
    lineHeight: 22,
    marginBottom: 16,
    textAlign: "center",
  },
  dialogSubText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    marginBottom: 12,
  },
  passwordInput: {
    backgroundColor: COLORS.cardBackgroundAlt,
    borderRadius: 12,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: "Poppins-Regular",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    marginBottom: 16,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    alignItems: "center",
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.errorText,
    alignItems: "center",
  },
  deleteModalButtonDisabled: {
    opacity: 0.7,
  },
  deleteModalButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
  },
});

export default DeleteAccountModal;
