import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { PostHogProvider } from "posthog-react-native";

import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { MapStyleProvider } from "@/contexts/MapStyleContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { JobSessionInitializer } from "@/components/JobSessionInitializer";
import { useColorScheme } from "@/hooks/useColorScheme";
import { isRunningInExpoGo } from "expo";

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

// Initialize Sentry before the app renders
Sentry.init({
  dsn: "https://9c69ddf62f2bf7490416ba65f2d5dd2d@o4509054186815488.ingest.us.sentry.io/4509054187798528",
  debug: __DEV__, // Only enable debug in development
  tracesSampleRate: 0.1, // Sample only 10% of transactions
  integrations: [navigationIntegration],
  enableNativeFramesTracking: !isRunningInExpoGo(),
  sendDefaultPii: true,
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref?.current) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);

  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const Providers = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>
      <LocationProvider>
        <MapStyleProvider>
          <OnboardingProvider>
            <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
              <JobSessionInitializer />
              {children}
            </ThemeProvider>
          </OnboardingProvider>
        </MapStyleProvider>
      </LocationProvider>
    </AuthProvider>
  );

  return (
    <PostHogProvider
      apiKey="phc_HCnuKRNZ6OzogwrVT3UkLfOI4wiGONDB2hLXNgdJxCd"
      options={{
        host: "https://us.i.posthog.com",
      }}
    >
      <Providers>
        <Stack>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="scan" options={{ headerShown: false }} />
          <Stack.Screen name="user" options={{ headerShown: false }} />
          <Stack.Screen name="saved" options={{ headerShown: false }} />
          <Stack.Screen name="cluster" options={{ headerShown: false }} />
          <Stack.Screen name="filter" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="details" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </Providers>
    </PostHogProvider>
  );
}

export default Sentry.wrap(RootLayout);
