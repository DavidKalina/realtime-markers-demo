import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { OAuthButtons } from "@/components/Login/OAuthButtons";

interface RegistrationCardLayoutProps {
  children: React.ReactNode;
  onOAuthError: (error: Error) => void;
}

const RegistrationCardLayout: React.FC<RegistrationCardLayoutProps> = ({
  children,
  onOAuthError,
}) => (
  <View style={styles.formCard}>
    <View style={styles.stepContent}>{children}</View>
    <View style={styles.dividerContainer}>
      <View style={styles.divider} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.divider} />
    </View>
    <Text style={styles.oauthLabel}>Or continue with</Text>
    <OAuthButtons onError={onOAuthError} />
  </View>
);

const styles = StyleSheet.create({
  formCard: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minHeight: 420, // adjust as needed for your tallest step
    justifyContent: "space-between",
  },
  stepContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#6c757d",
    fontFamily: "Poppins-Regular",
  },
  oauthLabel: {
    textAlign: "center",
    color: "#6c757d",
    marginBottom: 8,
    fontFamily: "Poppins-Regular",
  },
});

export default RegistrationCardLayout;
