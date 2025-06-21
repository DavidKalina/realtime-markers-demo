import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { COLORS } from "./ScreenLayout";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "pro";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const getVariantStyles = (variant: BadgeVariant) => {
  switch (variant) {
    case "success":
      return {
        background: "rgba(64, 192, 87, 0.12)",
        border: "rgba(64, 192, 87, 0.2)",
        text: "#40c057",
      };
    case "warning":
      return {
        background: "rgba(251, 191, 36, 0.15)",
        border: "rgba(251, 191, 36, 0.3)",
        text: "#fbbf24",
      };
    case "error":
      return {
        background: "rgba(220, 38, 38, 0.1)",
        border: "rgba(220, 38, 38, 0.3)",
        text: "#dc2626",
      };
    case "pro":
      return {
        background: "rgba(251, 191, 36, 0.15)",
        border: "rgba(251, 191, 36, 0.3)",
        text: "#fbbf24",
      };
    default:
      return {
        background: COLORS.buttonBackground,
        border: COLORS.buttonBorder,
        text: COLORS.textPrimary,
      };
  }
};

const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "default",
  icon,
  style,
}) => {
  const variantStyles = getVariantStyles(variant);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: variantStyles.background,
          borderColor: variantStyles.border,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.text,
          {
            color: variantStyles.text,
            marginLeft: icon ? 4 : 0,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
  },
});

export default Badge;
