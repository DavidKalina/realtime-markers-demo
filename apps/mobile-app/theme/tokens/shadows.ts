// theme/tokens/shadows.ts - Platform-aware shadow presets
import { Platform, ViewStyle } from "react-native";

type ShadowPreset = Pick<
  ViewStyle,
  | "shadowColor"
  | "shadowOffset"
  | "shadowOpacity"
  | "shadowRadius"
  | "elevation"
>;

const createShadow = (
  offsetY: number,
  opacity: number,
  shadowRadius: number,
  elevation: number,
): ShadowPreset => ({
  ...Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: shadowRadius,
    },
    android: {
      elevation,
    },
  }),
});

export const shadows = {
  sm: createShadow(1, 0.05, 2, 1),
  md: createShadow(2, 0.1, 4, 3),
  lg: createShadow(4, 0.15, 8, 5),
  xl: createShadow(10, 0.2, 20, 10),
} as const;
