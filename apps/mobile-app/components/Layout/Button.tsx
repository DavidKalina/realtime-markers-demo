import React from "react";
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  ColorValue,
} from "react-native";
import { COLORS } from "./ScreenLayout";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "warning"
  | "error";
type ButtonSize = "small" | "medium" | "large";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ComponentType<{
    size?: number;
    color?: string | ColorValue;
    strokeWidth?: number;
  }>;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  icon: Icon,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: Icon ? 8 : 0,
    };

    // Size variations
    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      small: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 32,
      },
      medium: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 40,
      },
      large: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        minHeight: 48,
      },
    };

    // Variant styles
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
      },
      secondary: {
        backgroundColor: COLORS.cardBackground,
        borderColor: COLORS.buttonBorder,
      },
      outline: {
        backgroundColor: "transparent",
        borderColor: COLORS.accent,
      },
      ghost: {
        backgroundColor: "transparent",
        borderColor: "transparent",
      },
      warning: {
        backgroundColor: COLORS.warningBackground,
        borderColor: COLORS.warningBorder,
      },
      error: {
        backgroundColor: COLORS.errorBackground,
        borderColor: COLORS.errorBorder,
      },
    };

    const disabledStyle: ViewStyle = disabled
      ? {
          opacity: 0.5,
        }
      : {};

    const fullWidthStyle: ViewStyle = fullWidth
      ? {
          width: "100%",
        }
      : {};

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...disabledStyle,
      ...fullWidthStyle,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      fontFamily: "SpaceMono",
      fontWeight: "600",
      textAlign: "center",
    };

    // Size text variations
    const sizeTextStyles: Record<ButtonSize, TextStyle> = {
      small: {
        fontSize: 12,
      },
      medium: {
        fontSize: 14,
      },
      large: {
        fontSize: 16,
      },
    };

    // Variant text styles
    const variantTextStyles: Record<ButtonVariant, TextStyle> = {
      primary: {
        color: COLORS.background,
      },
      secondary: {
        color: COLORS.textPrimary,
      },
      outline: {
        color: COLORS.accent,
      },
      ghost: {
        color: COLORS.textPrimary,
      },
      warning: {
        color: COLORS.warningText,
      },
      error: {
        color: COLORS.errorText,
      },
    };

    return {
      ...baseTextStyle,
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
    };
  };

  const getIconColor = (): string => {
    switch (variant) {
      case "primary":
        return COLORS.background;
      case "outline":
        return COLORS.accent;
      case "warning":
        return COLORS.warningText;
      case "error":
        return COLORS.errorText;
      default:
        return COLORS.textPrimary;
    }
  };

  const getLoadingColor = (): string => {
    return getIconColor();
  };

  const iconSize = size === "small" ? 14 : size === "medium" ? 16 : 20;

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={getLoadingColor()}
          style={{ marginRight: Icon ? 0 : 8 }}
        />
      )}
      {!loading && Icon && (
        <Icon size={iconSize} color={getIconColor()} strokeWidth={2} />
      )}
      <Text style={[getTextStyle(), textStyle]}>
        {loading ? "Loading..." : title}
      </Text>
    </TouchableOpacity>
  );
};

export default Button;
