import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS } from "./ScreenLayout";

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  animated?: boolean;
  delay?: number;
}

const DetailItem: React.FC<DetailItemProps> = ({
  icon,
  label,
  value,
  children,
  style,
  animated = false,
  delay = 0,
}) => {
  const Container = animated ? Animated.View : View;

  return (
    <Container
      style={[styles.container, style]}
      entering={
        animated ? FadeInDown.duration(600).delay(delay).springify() : undefined
      }
    >
      <View style={styles.iconContainer}>{icon}</View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {children || (value && <Text style={styles.value}>{value}</Text>)}
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: 20,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Poppins-Regular",
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
    lineHeight: 20,
  },
});

export default DetailItem;
