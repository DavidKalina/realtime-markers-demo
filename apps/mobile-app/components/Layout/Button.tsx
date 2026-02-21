import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
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
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
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

  const getLoadingColor = (): string => {
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
          style={{ marginRight: 8 }}
        />
      )}
      <Text style={[getTextStyle(), textStyle]}>
        {loading ? "Loading..." : title}
      </Text>
    </TouchableOpacity>
  );
};

// Usage Examples Component
const ButtonExamples: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Button Variants</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Primary Buttons</Text>
        <Button
          title="Primary Small"
          variant="primary"
          size="small"
          onPress={() => {}}
        />
        <Button
          title="Primary Medium"
          variant="primary"
          size="medium"
          onPress={() => {}}
        />
        <Button
          title="Primary Large"
          variant="primary"
          size="large"
          onPress={() => {}}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Secondary Buttons</Text>
        <Button title="Secondary" variant="secondary" onPress={() => {}} />
        <Button title="Outline" variant="outline" onPress={() => {}} />
        <Button title="Ghost" variant="ghost" onPress={() => {}} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status Buttons</Text>
        <Button title="Warning" variant="warning" onPress={() => {}} />
        <Button title="Error" variant="error" onPress={() => {}} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>States</Text>
        <Button
          title="Disabled"
          variant="primary"
          disabled
          onPress={() => {}}
        />
        <Button title="Loading" variant="primary" loading onPress={() => {}} />
        <Button
          title="Full Width"
          variant="primary"
          fullWidth
          onPress={() => {}}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  heading: {
    fontSize: 24,
    fontFamily: "SpaceMono",
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
});

export default Button;
export { ButtonExamples };
