import "@/tasks/backgroundLocationTask";

import React, { useEffect, useRef } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { isRunningInExpoGo } from "expo";

import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { JobProgressProvider } from "@/contexts/JobProgressContext";
import { ThemeProvider, useTheme } from "@/theme";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ActionBar } from "@/components/ActionBar/ActionBar";
import { SENTRY_CONFIG, STACK_SCREEN_OPTIONS, SCREEN_CONFIGS } from "@/config";

// Initialize Sentry — guarded so a native SDK failure doesn't crash the app
let navigationIntegration: ReturnType<
  typeof Sentry.reactNavigationIntegration
> | null = null;
let sentryInitialized = false;

try {
  navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: !isRunningInExpoGo(),
  });

  Sentry.init({
    ...SENTRY_CONFIG,
    integrations: [navigationIntegration],
  });

  sentryInitialized = true;
} catch (e) {
  console.warn("Sentry initialization failed:", e);
}

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Types
interface AppProvidersProps {
  children: React.ReactNode;
}

interface AppContentProps {
  children: React.ReactNode;
}

// Navigation theme bridge — reads our ThemeContext and passes to React Navigation
function NavigationThemeBridge({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const navTheme = resolvedTheme === "dark" ? DarkTheme : DefaultTheme;
  return <NavThemeProvider value={navTheme}>{children}</NavThemeProvider>;
}

// App providers component
function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocationProvider>
          <JobProgressProvider>
            <NavigationThemeBridge>{children}</NavigationThemeBridge>
          </JobProgressProvider>
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppContent({ children }: AppContentProps) {
  usePushNotifications();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {children}
      <ActionBar />
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

// Main RootLayout component
function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  // Register navigation container with Sentry
  useEffect(() => {
    if (navigationRef?.current && navigationIntegration) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  // Load fonts
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Bungee: require("../assets/fonts/Bungee-Regular.ttf"),
  });

  // Hide splash screen when fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Show nothing while fonts are loading
  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProviders>
      <AppContent>
        <Stack screenOptions={STACK_SCREEN_OPTIONS}>
          {SCREEN_CONFIGS.map((screen) => (
            <Stack.Screen
              key={screen.name}
              name={screen.name}
              options={screen.options}
            />
          ))}
        </Stack>
      </AppContent>
    </AppProviders>
  );
}

export default sentryInitialized ? Sentry.wrap(RootLayout) : RootLayout;
