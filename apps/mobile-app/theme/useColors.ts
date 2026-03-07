// theme/useColors.ts - Hook to access theme-aware colors
import { useContext } from "react";
import { ThemeContext } from "./ThemeProvider";
import { colors as darkColors } from "./tokens/colors";

export type DeepStringify<T> = T extends string
  ? string
  : { [K in keyof T]: DeepStringify<T[K]> };

export type Colors = DeepStringify<typeof darkColors>;

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

export function useTheme() {
  return useContext(ThemeContext);
}
