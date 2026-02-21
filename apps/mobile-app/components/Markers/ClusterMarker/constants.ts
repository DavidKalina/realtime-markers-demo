import { Easing } from "react-native-reanimated";
import { colors } from "@/theme";

// Color schemes with teardrop design
export const COLOR_SCHEMES = {
  small: {
    fill: colors.bg.primary,
    stroke: colors.fixed.white,
    text: colors.text.primary,
    circleStroke: colors.brand.markerStroke,
  },
  medium: {
    fill: colors.bg.primary,
    stroke: colors.fixed.white,
    text: colors.text.primary,
    circleStroke: colors.brand.markerStroke,
  },
  large: {
    fill: colors.accent.primary,
    stroke: colors.accent.dark,
    text: colors.text.primary,
    circleStroke: colors.accent.dark,
  },
};

// Calculate marker size based on count
export const calculateMarkerSize = (count: number) => {
  if (count < 5) return 1;

  const baseSize = 1;
  const maxSize = 5.0;
  const growthRate = 0.2;

  const scale = Math.min(baseSize + Math.log10(count) * growthRate, maxSize);
  return scale;
};

// Animation configurations
export const ANIMATIONS = {
  SCALE_PRESS: {
    duration: 100,
  },
  SCALE_RELEASE: {
    stiffness: 200,
    damping: 12,
  },
  RIPPLE: {
    duration: 800,
  },
  SHADOW: {
    duration: 300,
  },
  FAN_OUT: {
    duration: 800,
    easing: Easing.out(Easing.back(1.2)),
  },
  FAN_IN: {
    duration: 600,
    easing: Easing.in(Easing.back(1.2)),
  },
};
