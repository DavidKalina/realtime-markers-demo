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
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
  spring,
} from "@/theme";

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
            .damping(spring.firm.damping)
            .stiffness(spring.firm.stiffness)}
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
            placeholderTextColor={colors.text.secondary}
            value={password}
            onChangeText={setPassword}
          />
          {deleteError ? (
            <Animated.View
              entering={BounceIn.duration(500)
                .springify()
                .damping(32)
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
                <ActivityIndicator size="small" color={colors.fixed.white} />
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
    backgroundColor: colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    width: "90%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  dialogText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.relaxed,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  dialogSubText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.md,
  },
  passwordInput: {
    backgroundColor: colors.bg.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  errorText: {
    color: colors.status.error.text,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    borderWidth: 1,
    borderColor: colors.border.medium,
    alignItems: "center",
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.status.error.text,
    alignItems: "center",
  },
  deleteModalButtonDisabled: {
    opacity: 0.7,
  },
  deleteModalButtonText: {
    color: colors.fixed.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
});

export default DeleteAccountModal;
