import { colors } from "@/theme";

// Dark-theme-only color hook. Simplified from the Expo template version.
const themeColors = {
  text: colors.text.primary,
  background: colors.bg.primary,
  tint: colors.fixed.white,
  icon: colors.text.secondary,
  tabIconDefault: colors.text.secondary,
  tabIconSelected: colors.fixed.white,
};

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof themeColors,
) {
  const colorFromProps = props.dark;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return themeColors[colorName];
  }
}
