import { Platform, ViewStyle } from "react-native";

type ShadowPreset = Pick<
  ViewStyle,
  "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation"
>;

const shadow = (
  color: string,
  offsetY: number,
  opacity: number,
  radius: number,
  elevation: number,
): ShadowPreset =>
  Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation },
    default: {},
  }) as ShadowPreset;

const warmBrown = "#5A3C1E";
const deepBrown = "#503214";
const inkShadow = "#1A140E";

export const edShadows = {
  cardResting: shadow(warmBrown, 12, 0.1, 14, 4),
  cardLifted: shadow(deepBrown, 18, 0.18, 18, 8),
  primaryBtn: shadow(inkShadow, 12, 0.3, 12, 6),
  tabBar: shadow(deepBrown, 12, 0.2, 14, 6),
} as const;
