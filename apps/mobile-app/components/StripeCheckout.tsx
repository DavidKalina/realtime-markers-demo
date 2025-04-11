import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface StripeCheckoutProps {
  sessionId: string;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({ sessionId }) => {
  const router = useRouter();

  const handleNavigationStateChange = (navState: any) => {
    // Check if the URL contains our success or cancel parameters
    if (navState.url.includes("mapmoji://profile")) {
      const url = new URL(navState.url);
      const status = url.searchParams.get("status");

      if (status === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
        // You might want to refresh the user's plan details here
      } else if (status === "cancel") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        router.back();
      }
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: `https://checkout.stripe.com/pay/${sessionId}` }}
        onNavigationStateChange={handleNavigationStateChange}
        style={styles.webview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  webview: {
    flex: 1,
  },
});

export default StripeCheckout;
