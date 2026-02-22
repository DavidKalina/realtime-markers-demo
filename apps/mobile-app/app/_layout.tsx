import React, { useEffect } from "react";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { LogBox, View } from "react-native";
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
import {
  SplashScreenProvider,
  useSplashScreen,
} from "@/contexts/SplashScreenContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ActionBar } from "@/components/ActionBar/ActionBar";
import { AnimatedSplashScreen } from "@/components/SplashScreen/SplashScreen";
import { SENTRY_CONFIG, STACK_SCREEN_OPTIONS, SCREEN_CONFIGS } from "@/config";

// Initialize Sentry
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  ...SENTRY_CONFIG,
  integrations: [navigationIntegration],
});

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Types
interface SplashScreenHandlerProps {
  children: React.ReactNode;
}

interface AppProvidersProps {
  children: React.ReactNode;
}

interface AppContentProps {
  children: React.ReactNode;
}

// SplashScreenHandler component
function SplashScreenHandler({ children }: SplashScreenHandlerProps) {
  const { shouldShowSplash, setSplashAnimationFinished } = useSplashScreen();

  const handleAnimationFinish = () => {
    setSplashAnimationFinished(true);
  };

  return (
    <>
      {children}
      {shouldShowSplash && (
        <AnimatedSplashScreen onAnimationFinish={handleAnimationFinish} />
      )}
    </>
  );
}

// App providers component (dark theme only)
function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <LocationProvider>
          <MapStyleProvider>
            <SplashScreenProvider>
              <ThemeProvider value={DarkTheme}>
                <SplashScreenHandler>{children}</SplashScreenHandler>
              </ThemeProvider>
            </SplashScreenProvider>
          </MapStyleProvider>
        </LocationProvider>
      </OnboardingProvider>
    </AuthProvider>
  );
}

// App content component
function AppContent({ children }: AppContentProps) {
  // Centralized auth guard — replaces per-screen <AuthWrapper>
  useAuthGuard();
  // Set up push notification listeners
  usePushNotifications();

  return (
    <View style={{ flex: 1 }}>
      {children}
      <ActionBar />
      <StatusBar style="auto" />
    </View>
  );
}

// Main RootLayout component
function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  // Register navigation container with Sentry
  useEffect(() => {
    if (navigationRef?.current) {
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

export default Sentry.wrap(RootLayout);
