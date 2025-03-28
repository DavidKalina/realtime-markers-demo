import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import * as Sentry from "@sentry/react-native";

import { useColorScheme } from "@/hooks/useColorScheme";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { MapStyleProvider } from "@/contexts/MapStyleContext";
import { isRunningInExpoGo } from "expo";

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
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

  useEffect(() => {
    // Initialize Sentry inside useEffect
    Sentry.init({
      dsn: "https://9c69ddf62f2bf7490416ba65f2d5dd2d@o4509054186815488.ingest.us.sentry.io/4509054187798528",
      debug: true, // If `true`, Sentry will try to print out useful debugging information if something goes wrong with sending the event. Set it to `false` in production
      tracesSampleRate: 1.0, // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing. Adjusting this value in production.
      integrations: [
        // Pass integration
        navigationIntegration,
      ],
      enableNativeFramesTracking: !isRunningInExpoGo(), // Tracks slow and frozen frames in the application

      sendDefaultPii: true,
    });

    // Establish the connection on app startup
    useJobSessionStore.getState().connect();
  }, []);

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

  return (
    <AuthProvider>
      <LocationProvider>
        <MapStyleProvider>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="register" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="scan" options={{ headerShown: false }} />
              <Stack.Screen name="upload" options={{ headerShown: false }} />
              <Stack.Screen name="share" options={{ headerShown: false }} />
              <Stack.Screen name="user" options={{ headerShown: false }} />
              <Stack.Screen name="saved" options={{ headerShown: false }} />
              <Stack.Screen name="cluster" options={{ headerShown: false }} />
              <Stack.Screen name="filter" options={{ headerShown: false }} />
              <Stack.Screen name="search" options={{ headerShown: false }} />
              <Stack.Screen name="details" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </MapStyleProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

export default Sentry.wrap(RootLayout);
