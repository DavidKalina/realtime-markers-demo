// theme/tokens/typography.ts - Font family, sizes, and weights

export const fontFamily = {
  mono: "SpaceMono",
  display: "Bungee",
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
} as const;

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const lineHeight = {
  tight: 18,
  normal: 20,
  relaxed: 22,
  loose: 24,
  heading: 32,
  display: 36,
} as const;

export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} as const;
