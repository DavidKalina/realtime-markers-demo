import "@/tasks/backgroundLocationTask";

import React, { useEffect } from "react";
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
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { isRunningInExpoGo } from "expo";

// Suppress known React Native dev-only error triggered during reload
// when Mapbox native modules send messages through the packager WebSocket.
// LogBox handles the console.error path; the global handler catches the
// native exception path that shows a red screen.
LogBox.ignoreLogs([
  "RCTPackagerConnection received message with not supported version",
]);

if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorUtils = (global as any).ErrorUtils;
  const originalHandler = errorUtils?.getGlobalHandler?.();
  if (originalHandler) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
      if (
        typeof error?.message === "string" &&
        error.message.includes(
          "RCTPackagerConnection received message with not supported version",
        )
      ) {
        return;
      }
      originalHandler(error, isFatal);
    });
  }
}

import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { MapStyleProvider } from "@/contexts/MapStyleContext";
import { JobProgressProvider } from "@/contexts/JobProgressContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { ThemeProvider, useTheme } from "@/theme";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ActionBar } from "@/components/ActionBar/ActionBar";
import XPNotificationOverlay from "@/components/Gamification/XPNotificationOverlay";
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
        <WebSocketProvider>
          <OnboardingProvider>
            <LocationProvider>
              <JobProgressProvider>
                <MapStyleProvider>
                  <NavigationThemeBridge>{children}</NavigationThemeBridge>
                </MapStyleProvider>
              </JobProgressProvider>
            </LocationProvider>
          </OnboardingProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// App content component
function AppContent({ children }: AppContentProps) {
  // Centralized auth guard — replaces per-screen <AuthWrapper>
  useAuthGuard();
  // Set up push notification listeners
  usePushNotifications();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {children}
      <ActionBar />
      <XPNotificationOverlay />
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
