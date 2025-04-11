import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CheckoutScreen() {
  const { checkoutUrl } = useLocalSearchParams<{ checkoutUrl: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const handleNavigationStateChange = (navState: any) => {
    // Check if we're back to our app after Stripe checkout
    if (navState.url.includes(process.env.EXPO_PUBLIC_API_URL!)) {
      const url = new URL(navState.url);
      const status = url.searchParams.get("status");

      if (status === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Replace current route with user profile to prevent back navigation
        router.replace({
          pathname: "/user",
          params: { paymentStatus: "success" }
        });
      } else if (status === "cancel") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        router.back();
      }
    }
  };

  if (!checkoutUrl) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        source={{ uri: checkoutUrl }}
        onNavigationStateChange={handleNavigationStateChange}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  webview: {
    flex: 1,
  },
});
