// theme/ThemeProvider.tsx - Theme context (dark theme only)
import React, { createContext } from "react";
import { colors as darkColors } from "./tokens/colors";
import type { Colors } from "./useColors";

export type ThemeMode = "dark";
export type ResolvedTheme = "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  resolvedTheme: "dark",
  colors: darkColors,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider
      value={{
        mode: "dark",
        resolvedTheme: "dark",
        colors: darkColors,
        setMode: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
