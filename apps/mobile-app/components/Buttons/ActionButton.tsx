import { COLORS } from "../Layout/ScreenLayout";
import { LucideIcon } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from "react-native";

type ButtonVariant = "primary" | "danger" | "secondary";

interface ActionButtonProps {
  onPress: () => void;
  label: string;
  icon?: LucideIcon;
  variant?: ButtonVariant;
  isLoading?: boolean;
  isDisabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  iconStyle?: ViewStyle;
}

const getVariantStyles = (variant: ButtonVariant) => {
  switch (variant) {
    case "danger":
      return {
        button: styles.dangerButton,
        text: styles.dangerButtonText,
      };
    case "secondary":
      return {
        button: styles.secondaryButton,
        text: styles.secondaryButtonText,
      };
    case "primary":
    default:
      return {
        button: styles.primaryButton,
        text: styles.primaryButtonText,
      };
  }
};

export default function ActionButton({
  onPress,
  label,
  icon: Icon,
  variant = "primary",
  isLoading = false,
  isDisabled = false,
  style,
  textStyle,
  iconStyle,
}: ActionButtonProps) {
  const variantStyles = getVariantStyles(variant);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variantStyles.button,
        (isLoading || isDisabled) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={isLoading || isDisabled}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "secondary" ? COLORS.accent : "#fff"}
        />
      ) : (
        <>
          {Icon && (
            <Icon
              size={18}
              color={variant === "secondary" ? COLORS.accent : "#fff"}
              style={[styles.icon, iconStyle]}
            />
          )}
          <Text style={[styles.text, variantStyles.text, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
  },
  dangerButton: {
    backgroundColor: "#DC2626", // Red-600
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  text: {
    fontSize: 16,
    fontFamily: "Poppins-Regular",
    fontWeight: "600",
  },
  primaryButtonText: {
    color: "#fff",
  },
  dangerButtonText: {
    color: "#fff",
  },
  secondaryButtonText: {
    color: COLORS.accent,
  },
  icon: {
    marginRight: 8,
  },
});
