import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuthErrorHandler } from "@/hooks/useAuthErrorHandler";
import { apiClient } from "@/services/ApiClient";

export const AuthErrorHandler: React.FC = () => {
  const { handleAuthError } = useAuthErrorHandler();

  const testApiCall = async () => {
    try {
      // This is an example of how to wrap API calls with error handling
      const result = await apiClient.pushNotifications.getTokens();
      Alert.alert("Success", `Found ${result.tokens.length} tokens`);
    } catch (error) {
      // Use the auth error handler to handle token mismatch and other auth errors
      await handleAuthError(error as Error, async () => {
        // Retry the API call after auth is fixed
        return await apiClient.pushNotifications.getTokens();
      });
    }
  };

  const testTokenMismatch = async () => {
    try {
      // Simulate a token mismatch by making a call with invalid tokens
      // This would normally happen when the stored token is outdated
      await apiClient.pushNotifications.sendTestNotification({
        title: "Test",
        body: "This might trigger a token mismatch",
      });
    } catch (error) {
      console.log("Handling potential token mismatch...");
      await handleAuthError(error as Error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auth Error Handler Test</Text>

      <TouchableOpacity style={styles.button} onPress={testApiCall}>
        <Text style={styles.buttonText}>Test API Call with Error Handling</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testTokenMismatch}>
        <Text style={styles.buttonText}>Test Token Mismatch Handling</Text>
      </TouchableOpacity>

      <Text style={styles.description}>
        These buttons demonstrate how to handle authentication errors
        gracefully. If a token mismatch occurs, the app will automatically clear
        auth state and redirect to the login screen.
      </Text>
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
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginTop: 15,
    textAlign: "center",
    lineHeight: 20,
  },
});
