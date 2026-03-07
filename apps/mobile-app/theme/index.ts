// theme/index.ts - Barrel re-export of all design tokens

export { colors } from "./tokens/colors";
export { lightColors } from "./tokens/lightColors";
export { spacing } from "./tokens/spacing";
export {
  typography,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "./tokens/typography";
export { radius } from "./tokens/radius";
export { shadows } from "./tokens/shadows";
export { animation, duration, spring } from "./tokens/animation";
export { ThemeProvider } from "./ThemeProvider";
export type { ThemeMode, ResolvedTheme } from "./ThemeProvider";
export { useColors, useTheme } from "./useColors";
export type { Colors } from "./useColors";
