import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { initStripe, useStripe } from "@stripe/stripe-react-native";
import { apiClient } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";

export default function CheckoutScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        await initStripe({
          publishableKey:
            "pk_test_51Qm2COFNykbtbgZXK7p168Ex0wT6UuqsSSIyjcC4N9dq4dibwYWR0JhKFnAjcSGYK5a9QoOop0FWbLYcD9Cphk2w00wv6bq37I",
          merchantIdentifier: "merchant.com.mapmoji.app",
          urlScheme: "mapmoji",
          setReturnUrlSchemeOnAndroid: true,
        });
      } catch (error) {
        console.error("Error initializing Stripe:", error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        router.back();
      }
    };

    initializeStripe();
  }, []);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        const { error } = await initPaymentSheet({
          merchantDisplayName: "Mapmoji",
          paymentIntentClientSecret: sessionId,
          allowsDelayedPaymentMethods: true,
        });

        if (error) {
          console.error("Error initializing payment sheet:", error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          router.back();
          return;
        }

        // Present the payment sheet immediately after initialization
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          console.error("Error presenting payment sheet:", presentError);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          router.back();
        } else {
          // Payment successful
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const planDetails = await apiClient.getPlanDetails();
          router.push({
            pathname: "/user",
            params: { planDetails: JSON.stringify(planDetails) },
          });
        }
      } catch (error) {
        console.error("Payment error:", error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      initializePayment();
    } else {
      router.back();
    }
  }, [sessionId, router, initPaymentSheet, presentPaymentSheet]);

  if (!sessionId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#93c5fd" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
});
