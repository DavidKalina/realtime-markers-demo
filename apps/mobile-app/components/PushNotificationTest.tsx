import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";

export const PushNotificationTest: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const {
    isInitialized,
    hasPermission,
    currentToken,
    sendTestNotification,
    hasRegisteredTokens,
  } = usePushNotifications();

  const [isCheckingTokens, setIsCheckingTokens] = useState(false);
  const [hasTokens, setHasTokens] = useState<boolean | null>(null);

  const handleSendTestNotification = async () => {
    try {
      const success = await sendTestNotification(
        "Test Notification",
        "This is a test notification from the app!",
      );

      if (success) {
        Alert.alert("Success", "Test notification sent successfully!");
      } else {
        Alert.alert("Error", "Failed to send test notification");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send test notification");
    }
  };

  const handleCheckTokens = async () => {
    setIsCheckingTokens(true);
    try {
      const tokens = await hasRegisteredTokens();
      setHasTokens(tokens);
      Alert.alert(
        "Token Status",
        tokens
          ? "You have registered push tokens"
          : "No registered push tokens found",
      );
    } catch (error) {
      Alert.alert("Error", "Failed to check token status");
    } finally {
      setIsCheckingTokens(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Push Notifications</Text>
        <Text style={styles.message}>
          Please log in to test push notifications
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Push Notifications</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Service Initialized: {isInitialized ? "✅" : "❌"}
        </Text>
        <Text style={styles.statusText}>
          Permission Granted: {hasPermission ? "✅" : "❌"}
        </Text>
        <Text style={styles.statusText}>
          Token Available: {currentToken ? "✅" : "❌"}
        </Text>
        <Text style={styles.statusText}>
          Has Registered Tokens:{" "}
          {hasTokens === null ? "?" : hasTokens ? "✅" : "❌"}
        </Text>
      </View>

      {currentToken && (
        <View style={styles.tokenContainer}>
          <Text style={styles.tokenLabel}>Current Token:</Text>
          <Text style={styles.tokenText} numberOfLines={3}>
            {currentToken}
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleSendTestNotification}
          disabled={!isInitialized || !hasPermission}
        >
          <Text style={styles.buttonText}>Send Test Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleCheckTokens}
          disabled={isCheckingTokens}
        >
          <Text style={styles.buttonText}>
            {isCheckingTokens ? "Checking..." : "Check Token Status"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    color: "#666",
  },
  statusContainer: {
    marginBottom: 15,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 5,
  },
  tokenContainer: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  tokenLabel: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  tokenText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#666",
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
  },
  secondaryButton: {
    backgroundColor: "#34C759",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
