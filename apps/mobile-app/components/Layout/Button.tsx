import React from "react";
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  ColorValue,
} from "react-native";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";

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
      borderRadius: radius.sm,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: Icon ? spacing.sm : 0,
    };

    // Size variations
    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      small: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing._6,
        minHeight: 28,
      },
      medium: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: spacing["4xl"],
      },
      large: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        minHeight: spacing["5xl"],
      },
    };

    // Variant styles
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: {
        backgroundColor: colors.accent.primary,
        borderColor: colors.accent.primary,
      },
      secondary: {
        backgroundColor: colors.bg.card,
        borderColor: colors.border.medium,
      },
      outline: {
        backgroundColor: colors.fixed.transparent,
        borderColor: colors.accent.primary,
      },
      ghost: {
        backgroundColor: colors.fixed.transparent,
        borderColor: colors.fixed.transparent,
      },
      warning: {
        backgroundColor: colors.status.warning.bg,
        borderColor: colors.status.warning.border,
      },
      error: {
        backgroundColor: colors.status.error.bg,
        borderColor: colors.status.error.border,
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
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      textAlign: "center",
    };

    // Size text variations
    const sizeTextStyles: Record<ButtonSize, TextStyle> = {
      small: {
        fontSize: fontSize.xs,
      },
      medium: {
        fontSize: fontSize.sm,
      },
      large: {
        fontSize: fontSize.md,
      },
    };

    // Variant text styles
    const variantTextStyles: Record<ButtonVariant, TextStyle> = {
      primary: {
        color: colors.bg.primary,
      },
      secondary: {
        color: colors.text.primary,
      },
      outline: {
        color: colors.accent.primary,
      },
      ghost: {
        color: colors.text.primary,
      },
      warning: {
        color: colors.status.warning.text,
      },
      error: {
        color: colors.status.error.text,
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
        return colors.bg.primary;
      case "outline":
        return colors.accent.primary;
      case "warning":
        return colors.status.warning.text;
      case "error":
        return colors.status.error.text;
      default:
        return colors.text.primary;
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
      {loading ? (
        <ActivityIndicator size="small" color={getLoadingColor()} />
      ) : (
        <>
          {Icon && (
            <Icon size={iconSize} color={getIconColor()} strokeWidth={2} />
          )}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;
