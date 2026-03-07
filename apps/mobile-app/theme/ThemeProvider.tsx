// theme/ThemeProvider.tsx - Theme context for dark/light mode switching
import React, { createContext, useCallback, useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as darkColors } from "./tokens/colors";
import { lightColors } from "./tokens/lightColors";
import type { Colors } from "./useColors";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "app-theme-mode";

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  resolvedTheme: "dark",
  colors: darkColors,
  setMode: () => {},
});

const colorsByTheme: Record<ResolvedTheme, Colors> = {
  dark: darkColors,
  light: lightColors,
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
      setLoaded(true);
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const resolvedTheme: ResolvedTheme =
    mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;

  const colors = colorsByTheme[resolvedTheme];

  if (!loaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
