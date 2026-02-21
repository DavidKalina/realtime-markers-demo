import { Text, type TextProps, StyleSheet } from "react-native";
import { fontSize, fontWeight, lineHeight } from "@/theme";

import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.loose,
  },
  defaultSemiBold: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.loose,
    fontWeight: fontWeight.semibold,
  },
  title: {
    fontSize: fontSize["4xl"],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.heading,
  },
  subtitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  link: {
    lineHeight: 30,
    fontSize: fontSize.md,
    color: "#0a7ea4",
  },
});
