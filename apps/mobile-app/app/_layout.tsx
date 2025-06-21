import React, { useEffect } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { PostHogProvider } from "posthog-react-native";
import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { View } from "react-native";
import { isRunningInExpoGo } from "expo";

import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { MapStyleProvider } from "@/contexts/MapStyleContext";
import {
  SplashScreenProvider,
  useSplashScreen,
} from "@/contexts/SplashScreenContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ActionBar } from "@/components/ActionBar/ActionBar";
import { AnimatedSplashScreen } from "@/components/SplashScreen/SplashScreen";

// Configuration constants
const SENTRY_CONFIG = {
  dsn: "https://9c69ddf62f2bf7490416ba65f2d5dd2d@o4509054186815488.ingest.us.sentry.io/4509054187798528",
  debug: false,
  tracesSampleRate: 0.1,
  enableNativeFramesTracking: !isRunningInExpoGo(),
  sendDefaultPii: true,
} as const;

const POSTHOG_CONFIG = {
  apiKey: "phc_HCnuKRNZ6OzogwrVT3UkLfOI4wiGONDB2hLXNgdJxCd",
  options: {
    host: "https://us.i.posthog.com",
  },
} as const;

const FONT_FAMILY = {
  // Poppins font family
  "Poppins-Thin": require("../assets/fonts/Poppins-Thin.ttf"),
  "Poppins-ExtraLight": require("../assets/fonts/Poppins-ExtraLight.ttf"),
  "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
  "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
  "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
  "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
  "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
  "Poppins-Black": require("../assets/fonts/Poppins-Black.ttf"),

  // Poppins Italic variants
  "Poppins-ThinItalic": require("../assets/fonts/Poppins-ThinItalic.ttf"),
  "Poppins-ExtraLightItalic": require("../assets/fonts/Poppins-ExtraLightItalic.ttf"),
  "Poppins-LightItalic": require("../assets/fonts/Poppins-LightItalic.ttf"),
  "Poppins-Italic": require("../assets/fonts/Poppins-Italic.ttf"),
  "Poppins-MediumItalic": require("../assets/fonts/Poppins-MediumItalic.ttf"),
  "Poppins-SemiBoldItalic": require("../assets/fonts/Poppins-SemiBoldItalic.ttf"),
  "Poppins-BoldItalic": require("../assets/fonts/Poppins-BoldItalic.ttf"),
  "Poppins-ExtraBoldItalic": require("../assets/fonts/Poppins-ExtraBoldItalic.ttf"),
  "Poppins-BlackItalic": require("../assets/fonts/Poppins-BlackItalic.ttf"),
} as const;

const STACK_SCREEN_OPTIONS = {
  headerShown: false,
  animation: "fade_from_bottom" as const,
  animationDuration: 200,
  gestureEnabled: true,
  gestureDirection: "horizontal" as const,
  contentStyle: {
    backgroundColor: "transparent",
  },
} as const;

const MODAL_SCREEN_OPTIONS = {
  presentation: "modal" as const,
  animation: "slide_from_bottom" as const,
  gestureEnabled: true,
  gestureDirection: "vertical" as const,
} as const;

// Screen configurations
const SCREEN_CONFIGS = [
  { name: "jobs" },
  { name: "register" },
  { name: "login" },
  { name: "index" },
  { name: "scan" },
  { name: "user" },
  { name: "saved/index" },
  { name: "cluster" },
  { name: "filter" },
  { name: "search/index" },
  { name: "search/list" },
  { name: "category/[id]" },
  { name: "details" },
  { name: "create-private-event", options: MODAL_SCREEN_OPTIONS },
  { name: "job-details", options: MODAL_SCREEN_OPTIONS },
  { name: "+not-found" },
] as const;

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

// App providers component
function AppProviders({ children }: AppProvidersProps) {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <LocationProvider>
        <MapStyleProvider>
          <SplashScreenProvider>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <SplashScreenHandler>{children}</SplashScreenHandler>
            </ThemeProvider>
          </SplashScreenProvider>
        </MapStyleProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

// App content component
function AppContent({ children }: AppContentProps) {
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
  const [fontsLoaded] = useFonts(FONT_FAMILY);

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
    <PostHogProvider
      apiKey={POSTHOG_CONFIG.apiKey}
      options={POSTHOG_CONFIG.options}
    >
      <AppProviders>
        <AppContent>
          <Stack screenOptions={STACK_SCREEN_OPTIONS}>
            {SCREEN_CONFIGS.map((screen) => (
              <Stack.Screen
                key={screen.name}
                name={screen.name}
                options={"options" in screen ? screen.options : undefined}
              />
            ))}
          </Stack>
        </AppContent>
      </AppProviders>
    </PostHogProvider>
  );
}

export default Sentry.wrap(RootLayout);
